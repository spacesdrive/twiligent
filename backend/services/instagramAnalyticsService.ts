import { fetchInstagramProfile } from './instagram/instagramApi.ts';
import { fetchInstagramMedia } from './instagram/instagramMedia.ts';
import { computeInstagramAnalytics } from './instagram/instagramAnalytics.ts';
import { NotFoundError, ValidationError } from '../lib/errors.ts';
import { safeAccount } from '../lib/safeAccount.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { AnalyticsCacheRepository } from '../repositories/analyticsCacheRepository.ts';
import type { RequestContext } from '../types/context.ts';
import type { Account, SafeAccount } from '../../shared/types/domain.ts';
import type { InstagramAnalytics, InstagramMedia, InstagramProfile } from '../../shared/types/instagram.ts';

export interface InstagramAnalyticsDeps {
    accounts: AccountRepository;
    cache: AnalyticsCacheRepository;
    context: RequestContext;
}

export interface InstagramAccountAnalytics {
    profile: InstagramProfile;
    account: SafeAccount;
    analytics: InstagramAnalytics;
    mediaCount: number;
}

export interface InstagramMediaList {
    media: InstagramMedia[];
    fetchedAt: string;
}

export interface InstagramAnalyticsService {
    analytics(userId: string, accountId: string): Promise<InstagramAccountAnalytics>;
    media(userId: string, accountId: string): Promise<InstagramMediaList>;
}

type ConnectedInstagramAccount = Account & { igUserId: string; accessToken: string };

const MEDIA_LIMIT = 500;

export function createInstagramAnalyticsService({ accounts, cache, context }: InstagramAnalyticsDeps): InstagramAnalyticsService {
    const { signal } = context;

    async function findConnected(userId: string, accountId: string): Promise<ConnectedInstagramAccount> {
        const account = await accounts.findForUser(accountId, userId);
        if (!account || account.platform !== 'instagram') throw new NotFoundError('Instagram account not found');
        if (!account.accessToken || !account.igUserId) throw new ValidationError('No access token stored - reconnect this Instagram account');
        return { ...account, igUserId: account.igUserId, accessToken: account.accessToken };
    }

    return {
        // always live: the media is cached and the profile counts are saved for the Overview
        async analytics(userId, accountId) {
            const account = await findConnected(userId, accountId);
            const [profile, media] = await Promise.all([
                fetchInstagramProfile(account.igUserId, account.accessToken, signal),
                fetchInstagramMedia(account.igUserId, account.accessToken, MEDIA_LIMIT, signal),
            ]);
            await Promise.all([
                cache.setInstagramMedia(userId, accountId, { media, fetchedAt: new Date().toISOString() }),
                accounts.updateForUser(account.id, {
                    followersCount: profile.followersCount,
                    followsCount: profile.followsCount,
                    mediaCount: profile.mediaCount,
                    profilePictureUrl: profile.profilePictureUrl,
                    lastUpdated: new Date().toISOString(),
                }, userId),
            ]);
            return { profile, account: safeAccount(account), analytics: computeInstagramAnalytics(profile, media), mediaCount: media.length };
        },

        async media(userId, accountId) {
            const cached = await cache.getInstagramMedia(userId, accountId);
            if (cached?.media) return { media: cached.media, fetchedAt: cached.fetchedAt };
            const account = await findConnected(userId, accountId);
            const media = await fetchInstagramMedia(account.igUserId, account.accessToken, MEDIA_LIMIT, signal);
            const fetchedAt = new Date().toISOString();
            await cache.setInstagramMedia(userId, accountId, { media, fetchedAt });
            return { media, fetchedAt };
        },
    };
}
