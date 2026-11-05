import { createAccountRepository } from './repositories/accountRepository.ts';
import { createAnalyticsCacheRepository } from './repositories/analyticsCacheRepository.ts';
import { createScheduledPostRepository } from './repositories/scheduledPostRepository.ts';
import { createTrackedPostRepository } from './repositories/trackedPostRepository.ts';
import { createSettingsRepository } from './repositories/settingsRepository.ts';
import { createEmailQuotaRepository } from './repositories/emailQuotaRepository.ts';
import { createYouTubeQuotaRepository } from './repositories/youtubeQuotaRepository.ts';
import { createYouTubeQuotaService } from './services/youtubeQuotaService.ts';
import { createMediaAssetRepository } from './repositories/mediaAssetRepository.ts';
import { createYouTubeConnectionRepository } from './repositories/youtubeConnectionRepository.ts';
import { createYouTubeUploadRepository } from './repositories/youtubeUploadRepository.ts';
import { createYouTubeQuotaLedgerRepository } from './repositories/youtubeQuotaLedgerRepository.ts';
import { createYouTubeConnectService } from './services/youtubeConnectService.ts';
import { createYouTubeUploadService } from './services/youtubeUploadService.ts';
import { createYouTubeUploadRunner } from './services/youtubeUploadRunner.ts';
import { createMediaService } from './services/mediaService.ts';
import { createAuditRepository } from './repositories/auditRepository.ts';
import { createAutomationRuleRepository } from './repositories/automationRuleRepository.ts';
import { createAutomationCommentRepository } from './repositories/automationCommentRepository.ts';
import { createAutomationAccountRepository } from './repositories/automationAccountRepository.ts';
import { createAutomationFollowupRepository } from './repositories/automationFollowupRepository.ts';
import { createAutomationPublicReplyRepository } from './repositories/automationPublicReplyRepository.ts';
import { createHealthRepository } from './repositories/healthRepository.ts';
import { createMcpAccessTokenRepository } from './repositories/mcpAccessTokenRepository.ts';
import { createMcpClientGrantRepository } from './repositories/mcpClientGrantRepository.ts';
import { createAccountService } from './services/accountService.ts';
import { createYouTubeAnalyticsService } from './services/youtubeAnalyticsService.ts';
import { createInstagramAnalyticsService } from './services/instagramAnalyticsService.ts';
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
import { createAutomationFollowupProcessor } from './services/automationFollowupProcessor.ts';
import { createAutomationPublicReplyProcessor } from './services/automationPublicReplyProcessor.ts';
import { createAutomationReconciler } from './services/automationReconciler.ts';
import { createRetentionService } from './services/retentionService.ts';
import { createHealthService } from './services/healthService.ts';
import { createMcpAccessService } from './services/mcpAccessService.ts';
import { createMcpService } from './services/mcpService.ts';
import { MCP_TOOLS, mcpServerIdentity } from './mcp/registry.ts';
import { APP_VERSION } from './lib/version.ts';
import type { AccountService } from './services/accountService.ts';
import type { HealthService } from './services/healthService.ts';
import type { YouTubeAnalyticsService } from './services/youtubeAnalyticsService.ts';
import type { InstagramAnalyticsService } from './services/instagramAnalyticsService.ts';
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
import type { AutomationFollowupProcessor } from './services/automationFollowupProcessor.ts';
import type { AutomationPublicReplyProcessor } from './services/automationPublicReplyProcessor.ts';
import type { AutomationReconciler } from './services/automationReconciler.ts';
import type { RetentionService } from './services/retentionService.ts';
import type { McpAccessService, McpPrincipal } from './services/mcpAccessService.ts';
import type { McpService } from './services/mcpService.ts';
import type { MediaService } from './services/mediaService.ts';
import type { YouTubeConnectService } from './services/youtubeConnectService.ts';
import type { YouTubeUploadService } from './services/youtubeUploadService.ts';
import type { YouTubeUploadRunner } from './services/youtubeUploadRunner.ts';
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
    publishing: PublishingService;
    scheduledPosts: ScheduledPostService;
    scheduledPublisher: ScheduledPublisher;
    tokenRefresh: TokenRefreshService;
    trackedContent: TrackedContentService;
    overview: OverviewService;
    settings: SettingsService;
    media: MediaService;
    youtubeConnect: YouTubeConnectService;
    youtubeUploads: YouTubeUploadService;
    youtubeRunner: YouTubeUploadRunner;
    instagramConnect: InstagramConnectService;
    authEmail: AuthEmailService;
    automations: AutomationService;
    automationWebhook: AutomationWebhookService;
    automationProcessor: AutomationProcessor;
    automationFollowups: AutomationFollowupProcessor;
    automationPublicReplies: AutomationPublicReplyProcessor;
    automationReconciler: AutomationReconciler;
    retention: RetentionService;
    health: HealthService;
    mcpAccess: McpAccessService;
    // the MCP endpoint for one verified caller; built per request because it is bound to that caller
    mcpFor(principal: McpPrincipal): McpService;
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
    const followups = createAutomationFollowupRepository(clients.supabase);
    const publicReplies = createAutomationPublicReplyRepository(clients.supabase);
    const { automation } = config;
    const mcpTokens = createMcpAccessTokenRepository(clients.supabase);
    const mcpGrants = createMcpClientGrantRepository(clients.supabase);
    const scheduledPublisher = createScheduledPublisher({ accounts, posts, context });
    const media = createMediaAssetRepository(clients.supabase);
    const youtubeConnections = createYouTubeConnectionRepository(clients.supabase);
    const youtubeUploadRows = createYouTubeUploadRepository(clients.supabase);
    const youtubeConnect = createYouTubeConnectService({ connections: youtubeConnections, uploads: youtubeUploadRows, accounts, audit, config, context });
    // counters on the fail-fast client the rate limits use: without Redis nothing is metered
    const youtubeQuota = createYouTubeQuotaService({ quota: createYouTubeQuotaRepository(clients.rateLimitRedis) });
    const services: Services = {
        accounts: createAccountService({ accounts, cache, audit, config, context, youtubeQuota }),
        youtubeAnalytics: createYouTubeAnalyticsService({ accounts, cache, config, context, youtubeQuota }),
        instagramAnalytics: createInstagramAnalyticsService({ accounts, cache, context }),
        publishing: createPublishingService({ accounts, config, context }),
        scheduledPosts: createScheduledPostService({ accounts, posts }),
        scheduledPublisher,
        tokenRefresh: createTokenRefreshService({ accounts, context }),
        trackedContent: createTrackedContentService({ tracked, config, context, youtubeQuota }),
        overview: createOverviewService({ accounts, tracked, cache, config, youtubeQuota }),
        settings: createSettingsService({ settings, config }),
        media: createMediaService({ media, audit, config, context }),
        youtubeConnect,
        youtubeUploads: createYouTubeUploadService({ uploads: youtubeUploadRows, connections: youtubeConnections, media, audit, config }),
        youtubeRunner: createYouTubeUploadRunner({ uploads: youtubeUploadRows, connections: youtubeConnections, connect: youtubeConnect, ledger: createYouTubeQuotaLedgerRepository(clients.supabase), context }),
        instagramConnect: createInstagramConnectService({ accounts, audit, config, context }),
        authEmail: createAuthEmailService({ quota: createEmailQuotaRepository(clients.rateLimitRedis), config, context }),
        automations: createAutomationService({ accounts, rules, comments, followups, publicReplies, automationAccounts, audit, automation, context }),
        automationWebhook: createAutomationWebhookService({ rules, comments, followups, automation, context }),
        automationProcessor: createAutomationProcessor({ comments, automation, context }),
        automationFollowups: createAutomationFollowupProcessor({ followups, automation, context }),
        automationPublicReplies: createAutomationPublicReplyProcessor({ publicReplies, automation, context }),
        automationReconciler: createAutomationReconciler({ comments, publicReplies, context }),
        retention: createRetentionService({ comments, audit, context }),
        health: createHealthService({ health: createHealthRepository(clients.supabase) }),
        mcpAccess: createMcpAccessService({ tokens: mcpTokens, grants: mcpGrants, audit, context }),
        mcpFor: principal => createMcpService({
            tools: MCP_TOOLS, services, principal, audit, config: config.mcp, server: mcpServerIdentity(APP_VERSION), context,
        }),
    };
    return services;
}
