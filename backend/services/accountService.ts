import { resolveChannelId, fetchChannelData } from './youtube/youtubeChannels.ts';
import { fetchInstagramProfile } from './instagram/instagramApi.ts';
import { buildYouTubeAccount } from './accountFactory.ts';
import { ConflictError, NotConfiguredError, NotFoundError, RateLimitedError, ValidationError, isUniqueViolation } from '../lib/errors.ts';
import { UNMETERED_YOUTUBE_QUOTA } from './youtubeQuotaService.ts';
import type { YouTubeQuotaService } from './youtubeQuotaService.ts';
import type { YouTubeConnectService } from './youtubeConnectService.ts';
import type { YouTubeKey } from './youtube/youtubeApi.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { AnalyticsCacheRepository } from '../repositories/analyticsCacheRepository.ts';
import type { AuditRepository } from '../repositories/auditRepository.ts';
import type { AppConfig } from '../lib/config.ts';
import type { RequestContext } from '../types/context.ts';
import type { Account, AccountRefreshResult, NewAccount } from '../../shared/types/domain.ts';
import type { YouTubeChannelData } from '../../shared/types/youtube.ts';
import type { InstagramProfile } from '../../shared/types/instagram.ts';

export interface AccountServiceDeps {
    accounts: AccountRepository;
    cache: AnalyticsCacheRepository;
    audit: AuditRepository;
    config: AppConfig;
    context: RequestContext;
    youtubeQuota?: YouTubeQuotaService;
    youtubePublishing?: Pick<YouTubeConnectService, 'disconnectChannel'>;
}

export interface RefreshAllOutcome {
    accounts: Account[];
    results: AccountRefreshResult[];
}

export interface AccountService {
    list(userId: string): Promise<Account[]>;
    resolveChannel(userId: string, input: string): Promise<YouTubeChannelData>;
    addYouTube(userId: string, input: string): Promise<NewAccount>;
    refresh(userId: string, accountId: string): Promise<Account>;
    refreshAll(userId: string): Promise<RefreshAllOutcome>;
    remove(userId: string, accountId: string): Promise<void>;
}

export const NO_YOUTUBE_KEY_MESSAGE = 'YouTube API key not configured on server';
const NO_TOKEN_MESSAGE = 'No access token stored - reconnect this Instagram account';
const NO_CHANNEL_MESSAGE = 'No YouTube channel ID stored - delete this channel and add it again';

// full adds the fields only a single account refresh updates
function instagramUpdates(profile: InstagramProfile, full: boolean): Partial<Account> {
    const updates = {
        followersCount: profile.followersCount,
        followsCount: profile.followsCount,
        mediaCount: profile.mediaCount,
        title: profile.name || profile.username,
        username: profile.username,
        profilePictureUrl: profile.profilePictureUrl,
    };
    if (!full) return updates;
    return { ...updates, biography: profile.biography, website: profile.website };
}

function youtubeUpdates(channelData: YouTubeChannelData, full: boolean): Partial<Account> {
    const { subscriberCount, viewCount, videoCount, title, thumbnails } = channelData;
    if (!full) return { subscriberCount, viewCount, videoCount, title, thumbnails };
    return {
        subscriberCount, viewCount, videoCount, title,
        description: channelData.description,
        thumbnails,
        customUrl: channelData.customUrl,
        country: channelData.country,
        keywords: channelData.keywords,
        topicCategories: channelData.topicCategories,
    };
}

const CHANNEL_ADDED = 'This channel is already added';

export function createAccountService({ accounts, cache, audit, config, context, youtubeQuota = UNMETERED_YOUTUBE_QUOTA, youtubePublishing }: AccountServiceDeps): AccountService {
    const { signal } = context;

    function youtubeKey(): string {
        if (!config.youtubeApiKey) throw new NotConfiguredError(NO_YOUTUBE_KEY_MESSAGE);
        return config.youtubeApiKey;
    }

    // the list check misses an add made at the same moment; the unique index catches it, with the same answer
    async function createUnlessAdded(account: NewAccount, userId: string, alreadyAdded: string): Promise<void> {
        try {
            await accounts.create(account, userId);
        } catch (err) {
            if (isUniqueViolation(err)) throw new ConflictError(alreadyAdded);
            throw err;
        }
    }

    async function findOwned(userId: string, accountId: string): Promise<Account> {
        const account = await accounts.findForUser(accountId, userId);
        if (!account) throw new NotFoundError('Account not found');
        return account;
    }

    // the platform call needs these fields; a missing one is reported before any request goes out
    async function fetchProfileUpdates(account: Account, full: boolean, key?: YouTubeKey): Promise<Partial<Account>> {
        if (account.platform === 'instagram') {
            if (!account.accessToken) throw new ValidationError(NO_TOKEN_MESSAGE);
            return instagramUpdates(await fetchInstagramProfile(account.igUserId, account.accessToken, signal), full);
        }
        if (!account.channelId) throw new ValidationError(NO_CHANNEL_MESSAGE);
        return youtubeUpdates(await fetchChannelData(account.channelId, key ?? youtubeKey(), signal), full);
    }

    async function refreshListed(userId: string, account: Account, key?: YouTubeKey): Promise<void> {
        const updates = { lastUpdated: new Date().toISOString(), ...await fetchProfileUpdates(account, false, key) };
        await accounts.updateForUser(account.id, updates, userId);
    }

    return {
        list: userId => accounts.listForUser(userId),

        // a lookup by name can cost 100 quota units, so it counts against the member who asked
        async resolveChannel(userId, input) {
            return youtubeQuota.run(userId, youtubeKey(), async key => fetchChannelData(await resolveChannelId(input, key, signal), key, signal));
        },

        async addYouTube(userId, input) {
            const [channelId, channelData, existing] = await youtubeQuota.run(userId, youtubeKey(), async key => {
                const id = await resolveChannelId(input, key, signal);
                return [id, ...await Promise.all([fetchChannelData(id, key, signal), accounts.listForUser(userId)])] as const;
            });
            if (existing.find(account => account.channelId === channelId)) throw new ConflictError(CHANNEL_ADDED);

            const account = buildYouTubeAccount(channelData);
            await createUnlessAdded(account, userId, CHANNEL_ADDED);
            return account;
        },

        async refresh(userId, accountId) {
            const account = await findOwned(userId, accountId);
            const fetched = account.platform === 'youtube'
                ? await youtubeQuota.run(userId, youtubeKey(), key => fetchProfileUpdates(account, true, key))
                : await fetchProfileUpdates(account, true);
            const updates = { lastUpdated: new Date().toISOString(), ...fetched };
            await accounts.updateForUser(account.id, updates, userId);
            return { ...account, ...updates };
        },

        // one failure must not stop the rest; results line up with the accounts by index
        async refreshAll(userId) {
            const listed = await accounts.listForUser(userId);
            const settle = (key?: YouTubeKey) => Promise.allSettled(listed.map(account => refreshListed(userId, account, key)));
            let settled: PromiseSettledResult<void>[];
            if (!config.youtubeApiKey || !listed.some(account => account.platform === 'youtube')) {
                settled = await settle();
            } else {
                // one metered run for every channel, so a member with many channels pays two quota subrequests, not two each
                try {
                    settled = await youtubeQuota.run(userId, config.youtubeApiKey, key => settle(key));
                } catch (err) {
                    if (!(err instanceof RateLimitedError)) throw err;
                    // a used-up YouTube share stops only the channels; Instagram accounts still refresh
                    settled = await Promise.allSettled(listed.map(account => (account.platform === 'youtube' ? Promise.reject(err) : refreshListed(userId, account))));
                }
            }
            const results: AccountRefreshResult[] = settled.map((outcome, i) => (outcome.status === 'fulfilled'
                ? { id: listed[i].id, success: true }
                : { id: listed[i].id, success: false, error: (outcome.reason as Error)?.message }));
            return { accounts: await accounts.listForUser(userId), results };
        },

        // removing an account also removes its automation rules, received comments and reply history (foreign keys);
        // a channel verified for publishing has its Google access revoked first, so no upload outlives its card
        async remove(userId, accountId) {
            const account = await findOwned(userId, accountId);
            if (account.platform === 'youtube' && account.channelId && youtubePublishing) await youtubePublishing.disconnectChannel(userId, account.channelId);
            await Promise.all([
                accounts.deleteForUser(accountId, userId),
                cache.deleteAllForAccount(userId, accountId),
            ]);
            await audit.recordForUser(userId, { action: 'account.removed', subjectType: 'account', subjectId: accountId, details: { platform: account.platform } });
        },
    };
}
