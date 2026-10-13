import { createAccountRepository } from './repositories/accountRepository.ts';
import { createAnalyticsCacheRepository } from './repositories/analyticsCacheRepository.ts';
import { createScheduledPostRepository } from './repositories/scheduledPostRepository.ts';
import { createAccountService } from './services/accountService.ts';
import { createYouTubeAnalyticsService } from './services/youtubeAnalyticsService.ts';
import { createInstagramAnalyticsService } from './services/instagramAnalyticsService.ts';
import { createRedditAnalyticsService } from './services/redditAnalyticsService.ts';
import { createPublishingService } from './services/publishingService.ts';
import { createScheduledPublisher } from './services/scheduledPublisher.ts';
import { createScheduledPostService } from './services/scheduledPostService.ts';
import { createTokenRefreshService } from './services/tokenRefreshService.ts';
import type { AccountService } from './services/accountService.ts';
import type { YouTubeAnalyticsService } from './services/youtubeAnalyticsService.ts';
import type { InstagramAnalyticsService } from './services/instagramAnalyticsService.ts';
import type { RedditAnalyticsService } from './services/redditAnalyticsService.ts';
import type { PublishingService } from './services/publishingService.ts';
import type { ScheduledPublisher } from './services/scheduledPublisher.ts';
import type { ScheduledPostService } from './services/scheduledPostService.ts';
import type { TokenRefreshService } from './services/tokenRefreshService.ts';
import type { AppConfig } from './lib/config.ts';
import type { RequestContext } from './types/context.ts';
import type { Redis, SupabaseClient } from './types/app.ts';

export interface Clients {
    supabase: SupabaseClient;
    redis: Redis | null;
}

export interface Services {
    accounts: AccountService;
    youtubeAnalytics: YouTubeAnalyticsService;
    instagramAnalytics: InstagramAnalyticsService;
    redditAnalytics: RedditAnalyticsService;
    publishing: PublishingService;
    scheduledPosts: ScheduledPostService;
    scheduledPublisher: ScheduledPublisher;
    tokenRefresh: TokenRefreshService;
}

// the composition root: wires repositories into services for one request or one cron run; building them is cheap
export function createServices(clients: Clients, config: AppConfig, context: RequestContext): Services {
    const accounts = createAccountRepository(clients.supabase);
    const cache = createAnalyticsCacheRepository(clients.redis);
    const posts = createScheduledPostRepository(clients.supabase);
    const scheduledPublisher = createScheduledPublisher({ accounts, posts, context });
    return {
        accounts: createAccountService({ accounts, cache, config, context }),
        youtubeAnalytics: createYouTubeAnalyticsService({ accounts, cache, config, context }),
        instagramAnalytics: createInstagramAnalyticsService({ accounts, cache, context }),
        redditAnalytics: createRedditAnalyticsService({ accounts, cache, context }),
        publishing: createPublishingService({ accounts, config, context }),
        scheduledPosts: createScheduledPostService({ posts, publisher: scheduledPublisher }),
        scheduledPublisher,
        tokenRefresh: createTokenRefreshService({ accounts, context }),
    };
}
