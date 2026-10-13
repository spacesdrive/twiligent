import { createAccountRepository } from './repositories/accountRepository.ts';
import { createAnalyticsCacheRepository } from './repositories/analyticsCacheRepository.ts';
import { createAccountService } from './services/accountService.ts';
import { createYouTubeAnalyticsService } from './services/youtubeAnalyticsService.ts';
import { createInstagramAnalyticsService } from './services/instagramAnalyticsService.ts';
import { createRedditAnalyticsService } from './services/redditAnalyticsService.ts';
import type { AccountService } from './services/accountService.ts';
import type { YouTubeAnalyticsService } from './services/youtubeAnalyticsService.ts';
import type { InstagramAnalyticsService } from './services/instagramAnalyticsService.ts';
import type { RedditAnalyticsService } from './services/redditAnalyticsService.ts';
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
}

// the composition root: wires repositories into services for one request or one cron run; building them is cheap
export function createServices(clients: Clients, config: AppConfig, context: RequestContext): Services {
    const accounts = createAccountRepository(clients.supabase);
    const cache = createAnalyticsCacheRepository(clients.redis);
    return {
        accounts: createAccountService({ accounts, cache, config, context }),
        youtubeAnalytics: createYouTubeAnalyticsService({ accounts, cache, config, context }),
        instagramAnalytics: createInstagramAnalyticsService({ accounts, cache, context }),
        redditAnalytics: createRedditAnalyticsService({ accounts, cache, context }),
    };
}
