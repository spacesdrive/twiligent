import { createAccountRepository } from './repositories/accountRepository.ts';
import { createAnalyticsCacheRepository } from './repositories/analyticsCacheRepository.ts';
import { createScheduledPostRepository } from './repositories/scheduledPostRepository.ts';
import { createTrackedPostRepository } from './repositories/trackedPostRepository.ts';
import { createSettingsRepository } from './repositories/settingsRepository.ts';
import { createEmailQuotaRepository } from './repositories/emailQuotaRepository.ts';
import { createAuditRepository } from './repositories/auditRepository.ts';
import { createAutomationRuleRepository } from './repositories/automationRuleRepository.ts';
import { createAutomationCommentRepository } from './repositories/automationCommentRepository.ts';
import { createAutomationAccountRepository } from './repositories/automationAccountRepository.ts';
import { createAccountService } from './services/accountService.ts';
import { createYouTubeAnalyticsService } from './services/youtubeAnalyticsService.ts';
import { createInstagramAnalyticsService } from './services/instagramAnalyticsService.ts';
import { createRedditAnalyticsService } from './services/redditAnalyticsService.ts';
import { createPublishingService } from './services/publishingService.ts';
import { createScheduledPublisher } from './services/scheduledPublisher.ts';
import { createScheduledPostService } from './services/scheduledPostService.ts';
import { createTokenRefreshService } from './services/tokenRefreshService.ts';
import { createTrackedContentService } from './services/trackedContentService.ts';
import { createOverviewService } from './services/overviewService.ts';
import { createSettingsService } from './services/settingsService.ts';
import { createInstagramConnectService } from './services/instagramConnectService.ts';
import { createAuthEmailService } from './services/authEmailService.ts';
import { createAutomationService } from './services/automationService.ts';
import { createAutomationWebhookService } from './services/automationWebhookService.ts';
import { createAutomationProcessor } from './services/automationProcessor.ts';
import { createRetentionService } from './services/retentionService.ts';
import type { AccountService } from './services/accountService.ts';
import type { YouTubeAnalyticsService } from './services/youtubeAnalyticsService.ts';
import type { InstagramAnalyticsService } from './services/instagramAnalyticsService.ts';
import type { RedditAnalyticsService } from './services/redditAnalyticsService.ts';
import type { PublishingService } from './services/publishingService.ts';
import type { ScheduledPublisher } from './services/scheduledPublisher.ts';
import type { ScheduledPostService } from './services/scheduledPostService.ts';
import type { TokenRefreshService } from './services/tokenRefreshService.ts';
import type { TrackedContentService } from './services/trackedContentService.ts';
import type { OverviewService } from './services/overviewService.ts';
import type { SettingsService } from './services/settingsService.ts';
import type { InstagramConnectService } from './services/instagramConnectService.ts';
import type { AuthEmailService } from './services/authEmailService.ts';
import type { AutomationService } from './services/automationService.ts';
import type { AutomationWebhookService } from './services/automationWebhookService.ts';
import type { AutomationProcessor } from './services/automationProcessor.ts';
import type { RetentionService } from './services/retentionService.ts';
import type { AppConfig } from './lib/config.ts';
import type { RequestContext } from './types/context.ts';
import type { Redis, SupabaseClient } from './types/app.ts';

export interface Clients {
    supabase: SupabaseClient;
    redis: Redis | null;
    // fails fast instead of retrying; the email counters use it to stay inside the auth hook's time budget
    rateLimitRedis: Redis | null;
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
    trackedContent: TrackedContentService;
    overview: OverviewService;
    settings: SettingsService;
    instagramConnect: InstagramConnectService;
    authEmail: AuthEmailService;
    automations: AutomationService;
    automationWebhook: AutomationWebhookService;
    automationProcessor: AutomationProcessor;
    retention: RetentionService;
}

// the composition root: wires repositories into services for one request or one cron run; building them is cheap
export function createServices(clients: Clients, config: AppConfig, context: RequestContext): Services {
    const accounts = createAccountRepository(clients.supabase);
    const cache = createAnalyticsCacheRepository(clients.redis);
    const posts = createScheduledPostRepository(clients.supabase);
    const tracked = createTrackedPostRepository(clients.supabase);
    const settings = createSettingsRepository(clients.supabase);
    const audit = createAuditRepository(clients.supabase);
    const rules = createAutomationRuleRepository(clients.supabase);
    const comments = createAutomationCommentRepository(clients.supabase);
    const automationAccounts = createAutomationAccountRepository(clients.supabase);
    const { automation } = config;
    const scheduledPublisher = createScheduledPublisher({ accounts, posts, context });
    return {
        accounts: createAccountService({ accounts, cache, audit, config, context }),
        youtubeAnalytics: createYouTubeAnalyticsService({ accounts, cache, config, context }),
        instagramAnalytics: createInstagramAnalyticsService({ accounts, cache, context }),
        redditAnalytics: createRedditAnalyticsService({ accounts, cache, context }),
        publishing: createPublishingService({ accounts, config, context }),
        scheduledPosts: createScheduledPostService({ accounts, posts, publisher: scheduledPublisher }),
        scheduledPublisher,
        tokenRefresh: createTokenRefreshService({ accounts, context }),
        trackedContent: createTrackedContentService({ accounts, tracked, config, context }),
        overview: createOverviewService({ accounts, tracked, cache, config }),
        settings: createSettingsService({ settings, config }),
        instagramConnect: createInstagramConnectService({ accounts, audit, config, context }),
        authEmail: createAuthEmailService({ quota: createEmailQuotaRepository(clients.rateLimitRedis), config, context }),
        automations: createAutomationService({ accounts, rules, comments, automationAccounts, audit, automation, context }),
        automationWebhook: createAutomationWebhookService({ rules, comments, automation, context }),
        automationProcessor: createAutomationProcessor({ comments, automation, context }),
        retention: createRetentionService({ comments, audit, context }),
    };
}
