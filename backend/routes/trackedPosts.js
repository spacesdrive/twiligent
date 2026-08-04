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

const router = new Hono();

// List all tracked posts for the current user
router.get('/reddit/tracked-posts', async (c) => {
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    try {
        const posts = await getTrackedPosts(supabase, userId);
        return c.json(posts);
    } catch (err) {
        console.error('GET /reddit/tracked-posts:', err.message);
        return c.json({ error: err.message }, 500);
    }
});

// Add a new tracked post - fetches live data immediately using the account's cookie
router.post('/reddit/tracked-posts', async (c) => {
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const body = await c.req.json();
    const { url, accountId, label, category } = body;

    if (!url) return c.json({ error: 'url is required' }, 400);

    try {
        let cookie = null;
        if (accountId) {
            const account = await getAccountById(supabase, accountId, userId);
            if (!account || account.platform !== 'reddit') return c.json({ error: 'Reddit account not found' }, 404);
            cookie = account.cookie || null;
        }

        const postData = await fetchTrackedPostData(url, cookie);

        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        await createTrackedPost(supabase, { id, accountId, url, label, category }, userId);
        await updateTrackedPost(supabase, id, { data: postData }, userId);

        const created = await getTrackedPostById(supabase, id, userId);
        return c.json(created, 201);
    } catch (err) {
        console.error('POST /reddit/tracked-posts:', err.message);
        return c.json({ error: err.message }, 500);
    }
});

// Update label or category on a tracked post
router.put('/reddit/tracked-posts/:id', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const body = await c.req.json();
    const { label, category, accountId } = body;

    try {
        const existing = await getTrackedPostById(supabase, id, userId);
        if (!existing) return c.json({ error: 'Tracked post not found' }, 404);

        const updates = {};
        if (label    !== undefined) updates.label    = label;
        if (category !== undefined) updates.category = category;
        if (accountId !== undefined) updates.accountId = accountId;
        await updateTrackedPost(supabase, id, updates, userId);

        const updated = await getTrackedPostById(supabase, id, userId);
        return c.json(updated);
    } catch (err) {
        console.error(`PUT /reddit/tracked-posts/${id}:`, err.message);
        return c.json({ error: err.message }, 500);
    }
});

// Delete a tracked post
router.delete('/reddit/tracked-posts/:id', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    try {
        const existing = await getTrackedPostById(supabase, id, userId);
        if (!existing) return c.json({ error: 'Tracked post not found' }, 404);
        await deleteTrackedPost(supabase, id, userId);
        return c.json({ success: true });
    } catch (err) {
        console.error(`DELETE /reddit/tracked-posts/${id}:`, err.message);
        return c.json({ error: err.message }, 500);
    }
});

// Refresh live data for a single tracked post
router.post('/reddit/tracked-posts/:id/refresh', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    try {
        const existing = await getTrackedPostById(supabase, id, userId);
        if (!existing) return c.json({ error: 'Tracked post not found' }, 404);

        let cookie = null;
        if (existing.accountId) {
            const account = await getAccountById(supabase, existing.accountId, userId);
            cookie = account?.cookie || null;
        }

        const postData = await fetchTrackedPostData(existing.url, cookie);
        await updateTrackedPost(supabase, id, { data: postData }, userId);

        const updated = await getTrackedPostById(supabase, id, userId);
        return c.json(updated);
    } catch (err) {
        console.error(`POST /reddit/tracked-posts/${id}/refresh:`, err.message);
        return c.json({ error: err.message }, 500);
    }
});

export default router;
