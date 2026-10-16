import { resolveChannelId, fetchChannelData } from './youtube/youtubeChannels.ts';
import { fetchRedditProfile } from './reddit/redditApi.ts';
import { fetchInstagramProfile } from './instagram/instagramApi.ts';
import { exchangeForLongLivedToken, refreshLongLivedToken } from './instagram/instagramTokens.ts';
import { buildYouTubeAccount, buildRedditAccount, buildInstagramAccount } from './accountFactory.ts';
import { ConflictError, NotConfiguredError, NotFoundError, ValidationError } from '../lib/errors.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { AnalyticsCacheRepository } from '../repositories/analyticsCacheRepository.ts';
import type { AuditRepository } from '../repositories/auditRepository.ts';
import type { AppConfig } from '../lib/config.ts';
import type { RequestContext } from '../types/context.ts';
import type { Account, AccountRefreshResult, NewAccount } from '../../shared/types/domain.ts';
import type { YouTubeChannelData } from '../../shared/types/youtube.ts';
import type { RedditProfile } from '../../shared/types/reddit.ts';
import type { InstagramProfile } from '../../shared/types/instagram.ts';

export interface AccountServiceDeps {
    accounts: AccountRepository;
    cache: AnalyticsCacheRepository;
    audit: AuditRepository;
    config: AppConfig;
    context: RequestContext;
}

export interface RedditAccountInput {
    username: string;
    cookie: string;
}

export interface RefreshAllOutcome {
    accounts: Account[];
    results: AccountRefreshResult[];
}

export interface AccountService {
    list(userId: string): Promise<Account[]>;
    resolveChannel(input: string): Promise<YouTubeChannelData>;
    addYouTube(userId: string, input: string): Promise<NewAccount>;
    addReddit(userId: string, input: RedditAccountInput): Promise<Account>;
    addInstagram(userId: string, accessToken: string): Promise<Account>;
    refresh(userId: string, accountId: string): Promise<Account>;
    refreshAll(userId: string): Promise<RefreshAllOutcome>;
    refreshInstagramToken(userId: string, accountId: string): Promise<string>;
    remove(userId: string, accountId: string): Promise<void>;
}

interface PastedToken {
    token: string;
    expiresIn: number;
}

const DEFAULT_TOKEN_LIFETIME_S = 5184000;
export const NO_YOUTUBE_KEY_MESSAGE = 'YouTube API key not configured on server';
export const NO_COOKIE_MESSAGE = 'No session cookie stored - re-add this account with a session cookie from reddit.com DevTools';
const NO_TOKEN_MESSAGE = 'No access token stored - reconnect this Instagram account';
const NO_USERNAME_MESSAGE = 'No Reddit username stored - delete this account and add it again';
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

function redditUpdates(profile: RedditProfile): Partial<Account> {
    return {
        totalKarma: profile.totalKarma,
        postKarma: profile.postKarma,
        commentKarma: profile.commentKarma,
        iconUrl: profile.iconUrl,
    };
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

export function createAccountService({ accounts, cache, audit, config, context }: AccountServiceDeps): AccountService {
    const { signal, log } = context;

    function youtubeKey(): string {
        if (!config.youtubeApiKey) throw new NotConfiguredError(NO_YOUTUBE_KEY_MESSAGE);
        return config.youtubeApiKey;
    }

    async function findOwned(userId: string, accountId: string): Promise<Account> {
        const account = await accounts.findForUser(accountId, userId);
        if (!account) throw new NotFoundError('Account not found');
        return account;
    }

    // a pasted token may already be long-lived, so a failed exchange keeps it as is
    async function exchangePastedToken(accessToken: string): Promise<PastedToken> {
        const appSecret = config.instagram.appSecret;
        if (!appSecret) return { token: accessToken, expiresIn: 0 };
        try {
            const longToken = await exchangeForLongLivedToken(accessToken, appSecret, signal);
            return { token: longToken.accessToken, expiresIn: longToken.expiresIn };
        } catch (err) {
            log.info('token exchange skipped; the token may already be long-lived', { reason: (err as Error).message });
            return { token: accessToken, expiresIn: 0 };
        }
    }

    // the platform call needs these fields; a missing one is reported before any request goes out
    async function fetchProfileUpdates(account: Account, full: boolean): Promise<Partial<Account>> {
        if (account.platform === 'instagram') {
            if (!account.accessToken) throw new ValidationError(NO_TOKEN_MESSAGE);
            return instagramUpdates(await fetchInstagramProfile(account.igUserId, account.accessToken, signal), full);
        }
        if (account.platform === 'reddit') {
            if (!account.username) throw new ValidationError(NO_USERNAME_MESSAGE);
            if (!account.cookie) throw new ValidationError(NO_COOKIE_MESSAGE);
            return redditUpdates(await fetchRedditProfile(account.username, account.cookie, signal));
        }
        if (!account.channelId) throw new ValidationError(NO_CHANNEL_MESSAGE);
        return youtubeUpdates(await fetchChannelData(account.channelId, youtubeKey(), signal), full);
    }

    async function refreshListed(userId: string, account: Account): Promise<void> {
        const updates = { lastUpdated: new Date().toISOString(), ...await fetchProfileUpdates(account, false) };
        await accounts.updateForUser(account.id, updates, userId);
    }

    return {
        list: userId => accounts.listForUser(userId),

        async resolveChannel(input) {
            const apiKey = youtubeKey();
            return fetchChannelData(await resolveChannelId(input, apiKey, signal), apiKey, signal);
        },

        async addYouTube(userId, input) {
            const apiKey = youtubeKey();
            const channelId = await resolveChannelId(input, apiKey, signal);
            const [channelData, existing] = await Promise.all([
                fetchChannelData(channelId, apiKey, signal),
                accounts.listForUser(userId),
            ]);
            if (existing.find(account => account.channelId === channelId)) throw new ConflictError('This channel is already added');

            const account = buildYouTubeAccount(channelData);
            await accounts.create(account, userId);
            return account;
        },

        async addReddit(userId, { username, cookie }) {
            const profile = await fetchRedditProfile(username.replace(/^u\//i, '').trim(), cookie, signal);
            const existing = await accounts.listForUser(userId);
            if (existing.find(account => account.platform === 'reddit' && account.username === profile.username)) {
                throw new ConflictError('This Reddit account is already added');
            }

            const account = buildRedditAccount(profile, cookie);
            await accounts.create(account, userId);
            return account;
        },

        async addInstagram(userId, accessToken) {
            const { token, expiresIn } = await exchangePastedToken(accessToken);
            const profile = await fetchInstagramProfile(null, token, signal);
            if (!profile.igUserId) {
                throw new ValidationError('Could not get Instagram User ID. Make sure the token has instagram_business_basic permission and is from a Business/Creator account.');
            }
            const existing = await accounts.listForUser(userId);
            if (existing.find(account => account.platform === 'instagram' && account.igUserId === profile.igUserId)) {
                throw new ConflictError('This Instagram account is already added');
            }

            const account = buildInstagramAccount(profile, token, expiresIn);
            await accounts.create(account, userId);
            return account;
        },

        async refresh(userId, accountId) {
            const account = await findOwned(userId, accountId);
            const updates = { lastUpdated: new Date().toISOString(), ...await fetchProfileUpdates(account, true) };
            await accounts.updateForUser(account.id, updates, userId);
            return { ...account, ...updates };
        },

        // one failure must not stop the rest; results line up with the accounts by index
        async refreshAll(userId) {
            const listed = await accounts.listForUser(userId);
            const settled = await Promise.allSettled(listed.map(account => refreshListed(userId, account)));
            const results: AccountRefreshResult[] = settled.map((outcome, i) => (outcome.status === 'fulfilled'
                ? { id: listed[i].id, success: true }
                : { id: listed[i].id, success: false, error: (outcome.reason as Error)?.message }));
            return { accounts: await accounts.listForUser(userId), results };
        },

        async refreshInstagramToken(userId, accountId) {
            const account = await accounts.findForUser(accountId, userId);
            if (!account || account.platform !== 'instagram') throw new NotFoundError('Instagram account not found');
            if (!account.accessToken) throw new ValidationError(NO_TOKEN_MESSAGE);

            const refreshed = await refreshLongLivedToken(account.accessToken, signal);
            const tokenExpiresAt = new Date(Date.now() + (refreshed.expiresIn || DEFAULT_TOKEN_LIFETIME_S) * 1000).toISOString();
            await accounts.updateForUser(account.id, { accessToken: refreshed.accessToken, tokenExpiresAt }, userId);
            return tokenExpiresAt;
        },

        // removing an account also removes its automation rules, received comments and reply history (foreign keys)
        async remove(userId, accountId) {
            const account = await findOwned(userId, accountId);
            await Promise.all([
                accounts.deleteForUser(accountId, userId),
                cache.deleteAllForAccount(userId, accountId),
            ]);
            await audit.recordForUser(userId, { action: 'account.removed', subjectType: 'account', subjectId: accountId, details: { platform: account.platform } });
        },
    };
}
