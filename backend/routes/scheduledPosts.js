import { Hono } from 'hono';
import { getPosts, getPostById, createPost, updatePost, deletePost, deleteAllPosts } from '../lib/db.js';
import { generateId, processScheduledPosts } from '../utils/scheduler.js';

const app = new Hono();

app.get('/scheduled-posts', async (c) => {
    try {
        const posts = await getPosts(c.get('supabase'), c.get('userId'));
        return c.json({ success: true, posts });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});

app.post('/scheduled-posts', async (c) => {
    try {
        const body = await c.req.json();
        const {
            accountId, platform, mediaType, mediaUrl,
            caption, coverUrl, shareToFeed, collaborators,
            audioName, thumbOffset, locationId, userTags,
            altText, scheduledAt,
        } = body;

        if (!accountId || !mediaUrl || !scheduledAt) {
            return c.json({ success: false, message: 'accountId, mediaUrl, and scheduledAt are required' }, 400);
        }

        const scheduledDate = new Date(scheduledAt);
        if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
            return c.json({ success: false, message: 'scheduledAt must be a valid future date' }, 400);
        }

        const post = {
            id: generateId(),
            accountId,
            platform: platform || 'instagram',
            mediaType: mediaType || 'IMAGE',
            mediaUrl,
            caption: caption || '',
            coverUrl: coverUrl || null,
            shareToFeed: shareToFeed !== undefined ? shareToFeed : true,
            collaborators: collaborators || [],
            audioName: audioName || '',
            thumbOffset: thumbOffset || null,
            locationId: locationId || '',
            userTags: userTags || [],
            altText: altText || '',
            scheduledAt: scheduledDate.toISOString(),
            status: 'pending',
            createdAt: new Date().toISOString(),
            publishedMediaId: null,
            error: null,
        };

        await createPost(c.get('supabase'), post, c.get('userId'));
        return c.json({ success: true, post });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});

app.put('/scheduled-posts/:id', async (c) => {
    try {
        const supabase = c.get('supabase');
        const userId = c.get('userId');
        const id = c.req.param('id');
        const post = await getPostById(supabase, id, userId);
        if (!post) return c.json({ success: false, message: 'Scheduled post not found' }, 404);
        if (post.status !== 'pending' && post.status !== 'scheduled') {
            return c.json({ success: false, message: 'Can only edit pending posts' }, 400);
        }

        const body = await c.req.json();
        const allowed = ['caption', 'scheduledAt', 'shareToFeed', 'collaborators', 'audioName',
            'thumbOffset', 'locationId', 'userTags', 'altText', 'coverUrl'];
        const updates = {};
        for (const key of allowed) {
            if (body[key] !== undefined) updates[key] = body[key];
        }
        if (body.scheduledAt) updates.scheduledAt = new Date(body.scheduledAt).toISOString();

        await updatePost(supabase, id, updates, userId);
        const updated = await getPostById(supabase, id, userId);
        return c.json({ success: true, post: updated });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});

app.delete('/scheduled-posts', async (c) => {
    try {
        const { deleted, kept } = await deleteAllPosts(c.get('supabase'), c.get('userId'));
        return c.json({ success: true, deleted, kept });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});

app.delete('/scheduled-posts/:id', async (c) => {
    try {
        const supabase = c.get('supabase');
        const userId = c.get('userId');
        const id = c.req.param('id');
        const post = await getPostById(supabase, id, userId);
        if (!post) return c.json({ success: false, message: 'Scheduled post not found' }, 404);
        if (post.status === 'publishing') {
            return c.json({ success: false, message: 'Cannot delete a post that is currently publishing' }, 400);
        }
        await deletePost(supabase, id, userId);
        return c.json({ success: true, message: 'Scheduled post deleted' });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});

// Manual trigger for testing
app.get('/process-scheduled', async (c) => {
    const result = await processScheduledPosts(c.get('supabase'));
    return c.json({ success: true, ...result, timestamp: new Date().toISOString() });
});

app.post('/process-scheduled', async (c) => {
    const result = await processScheduledPosts(c.get('supabase'));
    return c.json({ success: true, ...result, timestamp: new Date().toISOString() });
});

export default app;
