import { Hono } from 'hono';
import accountRoutes from './accountRoutes.ts';
import authHookRoutes from './authHookRoutes.ts';
import automationRoutes from './automationRoutes.ts';
import analyticsRoutes from './analyticsRoutes.ts';
import instagramAuthRoutes from './instagramAuthRoutes.ts';
import instagramWebhookRoutes from './instagramWebhookRoutes.ts';
import overviewRoutes from './overviewRoutes.ts';
import publishingRoutes from './publishingRoutes.ts';
import redditRoutes from './redditRoutes.ts';
import scheduledPostRoutes from './scheduledPostRoutes.ts';
import settingsRoutes from './settingsRoutes.ts';
import trackedContentRoutes from './trackedContentRoutes.ts';
import { getHealth } from '../controllers/healthController.ts';
import { handleInstagramCallback } from '../controllers/instagramAuthController.ts';
import { rateLimit, clientIp } from '../middleware/rateLimit.ts';
import { RATE_LIMIT_RULES } from '../lib/rateLimit/rules.ts';
import type { AppEnv } from '../types/app.ts';

// reachable without a token: the health check, the OAuth redirect, whose signed state names the user,
// and the Supabase Auth email hook and Instagram webhook, whose signatures prove where they came from
export const publicRoutes = new Hono<AppEnv>();
publicRoutes.get('/health', ...getHealth);
publicRoutes.get('/auth/instagram/callback', rateLimit(RATE_LIMIT_RULES.oauth, clientIp), ...handleInstagramCallback);
publicRoutes.route('/', authHookRoutes);
publicRoutes.route('/', instagramWebhookRoutes);

// mounted behind requireAuth and the per-user rate limits in app.ts
export const protectedRoutes = new Hono<AppEnv>();
for (const routes of [
    accountRoutes, analyticsRoutes, redditRoutes, publishingRoutes, scheduledPostRoutes, trackedContentRoutes,
    overviewRoutes, settingsRoutes, instagramAuthRoutes, automationRoutes,
]) {
    protectedRoutes.route('/', routes);
}
