import { Hono } from 'hono';
import { getAccounts, getTrackedPosts } from '../lib/db.js';
import { summarizeAccountCaches } from '../services/overviewSummary.js';

const router = new Hono();

// the client re-polls while syncing, so warming never blocks the response
function runInBackground(c, tasks) {
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
    const apiKey = c.env.YOUTUBE_API_KEY?.replace(/^﻿/, '').trim();

    try {
        const [accounts, tracked] = await Promise.all([
            getAccounts(supabase, userId),
            getTrackedPosts(supabase, userId),
        ]);
        const { analyticsCache, warmTasks } = await summarizeAccountCaches(accounts, { redis, userId, apiKey });
        runInBackground(c, warmTasks);
        return c.json({ tracked, analyticsCache });
    } catch (err) {
        console.error('GET /overview:', err.message);
        return c.json({ error: err.message }, 500);
    }
});

export default router;
