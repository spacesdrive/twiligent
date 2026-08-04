import { Hono } from 'hono';
import {
    getTrackedPosts,
    getTrackedPostById,
    createTrackedPost,
    updateTrackedPost,
    deleteTrackedPost,
    getAccountById,
} from '../lib/db.js';
import { fetchTrackedPostData } from '../services/reddit.js';
import { fetchTrackedYouTubeData } from '../services/youtube.js';

const router = new Hono();

function detectContentType(url) {
    const lower = (url || '').toLowerCase();
    if (lower.includes('reddit.com') || lower.includes('redd.it')) return 'reddit';
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    return null;
}

// List all tracked content for the current user
router.get('/tracked-content', async (c) => {
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    try {
        const items = await getTrackedPosts(supabase, userId);
        return c.json(items);
    } catch (err) {
        console.error('GET /tracked-content:', err.message);
        return c.json({ error: err.message }, 500);
    }
});

// Add a new tracked content item (Reddit post or YouTube video)
router.post('/tracked-content', async (c) => {
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const body = await c.req.json();
    const { url, accountId, label, category } = body;

    if (!url) return c.json({ error: 'url is required' }, 400);

    const contentType = detectContentType(url.trim());
    if (!contentType) return c.json({ error: 'Only Reddit and YouTube URLs are supported' }, 400);

    try {
        let fetchedData;

        if (contentType === 'youtube') {
            const apiKey = c.env.YOUTUBE_API_KEY?.replace(/^﻿/, '').trim();
            if (!apiKey) return c.json({ error: 'YouTube API key not configured on this server' }, 400);
            fetchedData = await fetchTrackedYouTubeData(url.trim(), apiKey);
        } else {
            let cookie = null;
            if (accountId) {
                const account = await getAccountById(supabase, accountId, userId);
                if (!account || account.platform !== 'reddit') return c.json({ error: 'Reddit account not found' }, 404);
                cookie = account.cookie || null;
            }
            fetchedData = await fetchTrackedPostData(url.trim(), cookie);
        }

        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        await createTrackedPost(supabase, {
            id,
            accountId: contentType === 'youtube' ? null : (accountId || null),
            url: url.trim(),
            label,
            category,
            contentType,
        }, userId);
        await updateTrackedPost(supabase, id, { data: fetchedData }, userId);

        const created = await getTrackedPostById(supabase, id, userId);
        return c.json(created, 201);
    } catch (err) {
        console.error('POST /tracked-content:', err.message);
        return c.json({ error: err.message }, 500);
    }
});

// Update label, category, or account on a tracked content item
router.put('/tracked-content/:id', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const body = await c.req.json();
    const { label, category, accountId } = body;

    try {
        const existing = await getTrackedPostById(supabase, id, userId);
        if (!existing) return c.json({ error: 'Tracked content not found' }, 404);

        const updates = {};
        if (label     !== undefined) updates.label     = label;
        if (category  !== undefined) updates.category  = category;
        if (accountId !== undefined) updates.accountId = accountId;
        await updateTrackedPost(supabase, id, updates, userId);

        const updated = await getTrackedPostById(supabase, id, userId);
        return c.json(updated);
    } catch (err) {
        console.error(`PUT /tracked-content/${id}:`, err.message);
        return c.json({ error: err.message }, 500);
    }
});

// Delete a tracked content item
router.delete('/tracked-content/:id', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    try {
        const existing = await getTrackedPostById(supabase, id, userId);
        if (!existing) return c.json({ error: 'Tracked content not found' }, 404);
        await deleteTrackedPost(supabase, id, userId);
        return c.json({ success: true });
    } catch (err) {
        console.error(`DELETE /tracked-content/${id}:`, err.message);
        return c.json({ error: err.message }, 500);
    }
});

// Refresh live data for a single tracked content item
router.post('/tracked-content/:id/refresh', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    try {
        const existing = await getTrackedPostById(supabase, id, userId);
        if (!existing) return c.json({ error: 'Tracked content not found' }, 404);

        const contentType = existing.contentType || 'reddit';
        let fetchedData;

        if (contentType === 'youtube') {
            const apiKey = c.env.YOUTUBE_API_KEY?.replace(/^﻿/, '').trim();
            if (!apiKey) return c.json({ error: 'YouTube API key not configured on this server' }, 400);
            fetchedData = await fetchTrackedYouTubeData(existing.url, apiKey);
        } else {
            let cookie = null;
            if (existing.accountId) {
                const account = await getAccountById(supabase, existing.accountId, userId);
                cookie = account?.cookie || null;
            }
            fetchedData = await fetchTrackedPostData(existing.url, cookie);
        }

        await updateTrackedPost(supabase, id, { data: fetchedData }, userId);
        const updated = await getTrackedPostById(supabase, id, userId);
        return c.json(updated);
    } catch (err) {
        console.error(`POST /tracked-content/${id}/refresh:`, err.message);
        return c.json({ error: err.message }, 500);
    }
});

export default router;
