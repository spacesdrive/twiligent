import { Hono } from 'hono';
import { getAccounts, getTrackedPosts } from '../lib/db.ts';
import { summarizeAccountCaches } from '../services/overviewSummary.ts';
import type { AppContext, AppEnv } from '../types/app.ts';
import type { OverviewResponse } from '../../shared/types/domain.ts';

const router = new Hono<AppEnv>();

// the client re-polls while syncing, so warming never blocks the response
function runInBackground(c: AppContext, tasks: Promise<void>[]): void {
    if (tasks.length === 0) return;
    const ctx = c.executionCtx;
    if (ctx?.waitUntil) {
        ctx.waitUntil(Promise.allSettled(tasks));
        return;
    }
    Promise.allSettled(tasks).catch(() => {});
}

router.get('/overview', async (c) => {
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const redis = c.get('redis');
    const apiKey = c.env.YOUTUBE_API_KEY?.replace(/^\uFEFF/, '').trim();

    try {
        const [accounts, tracked] = await Promise.all([
            getAccounts(supabase, userId),
            getTrackedPosts(supabase, userId),
        ]);
        const { analyticsCache, warmTasks } = await summarizeAccountCaches(accounts, { redis, userId, apiKey });
        runInBackground(c, warmTasks);
        return c.json({ tracked, analyticsCache } satisfies OverviewResponse);
    } catch (err) {
        console.error('GET /overview:', (err as Error).message);
        return c.json({ error: (err as Error).message }, 500);
    }
});

export default router;
