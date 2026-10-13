import { fetchRedditProfile, fetchRedditPosts } from './reddit/redditApi.ts';
import { computeRedditAnalytics } from './reddit/redditAnalytics.ts';
import { NO_COOKIE_MESSAGE } from './accountService.ts';
import { NotFoundError, ValidationError } from '../lib/errors.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { AnalyticsCacheRepository } from '../repositories/analyticsCacheRepository.ts';
import type { RequestContext } from '../types/context.ts';
import type { RedditCacheData, RedditPost } from '../../shared/types/reddit.ts';

export interface RedditAnalyticsDeps {
    accounts: AccountRepository;
    cache: AnalyticsCacheRepository;
    context: RequestContext;
}

export interface RedditAnalyticsService {
    analytics(userId: string, accountId: string): Promise<RedditCacheData>;
    posts(userId: string, accountId: string): Promise<RedditPost[]>;
}

interface RedditCredentials {
    username: string;
    cookie: string;
}

const POST_LIMIT = 100;

export function createRedditAnalyticsService({ accounts, cache, context }: RedditAnalyticsDeps): RedditAnalyticsService {
    const { signal } = context;

    async function credentialsFor(userId: string, accountId: string): Promise<RedditCredentials> {
        const account = await accounts.findForUser(accountId, userId);
        if (!account || account.platform !== 'reddit') throw new NotFoundError('Reddit account not found');
        if (!account.cookie) throw new ValidationError(NO_COOKIE_MESSAGE);
        if (!account.username) throw new ValidationError('No Reddit username stored - delete this account and add it again');
        return { username: account.username, cookie: account.cookie };
    }

    return {
        async analytics(userId, accountId) {
            const { username, cookie } = await credentialsFor(userId, accountId);
            const cached = await cache.getReddit(userId, accountId);
            if (cached) return cached;

            const [profile, posts] = await Promise.all([
                fetchRedditProfile(username, cookie, signal),
                fetchRedditPosts(username, cookie, POST_LIMIT, signal),
            ]);
            const result: RedditCacheData = { profile, analytics: computeRedditAnalytics(profile, posts), posts };
            await cache.setReddit(userId, accountId, result);
            return result;
        },

        // the post list alone is not cached; only a full analytics load writes the cache
        async posts(userId, accountId) {
            const { username, cookie } = await credentialsFor(userId, accountId);
            const cached = await cache.getReddit(userId, accountId);
            if (cached?.posts) return cached.posts;
            return fetchRedditPosts(username, cookie, POST_LIMIT, signal);
        },
    };
}
