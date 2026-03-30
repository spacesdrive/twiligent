const router = require('express').Router();
const { readJSON, writeJSON, SCHEDULED_POSTS_FILE } = require('../utils/dataHelpers');
const { syncEverythingToGitHub } = require('../services/github');
const { generateId, processScheduledPosts } = require('../utils/scheduler');

router.get('/scheduled-posts', async (req, res) => {
    try {
        const posts = await readJSON(SCHEDULED_POSTS_FILE) || [];
        res.json({ success: true, posts });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/scheduled-posts', async (req, res) => {
    try {
        const {
            accountId, platform, mediaType, mediaUrl,
            caption, coverUrl, shareToFeed, collaborators,
            audioName, thumbOffset, locationId, userTags,
            altText, scheduledAt,
        } = req.body;

        if (!accountId || !mediaUrl || !scheduledAt) {
            return res.status(400).json({ success: false, message: 'accountId, mediaUrl, and scheduledAt are required' });
        }

        const scheduledDate = new Date(scheduledAt);
        if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
            return res.status(400).json({ success: false, message: 'scheduledAt must be a valid future date' });
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

        const posts = await readJSON(SCHEDULED_POSTS_FILE) || [];
        posts.push(post);
        await writeJSON(SCHEDULED_POSTS_FILE, posts);
        syncEverythingToGitHub().catch(() => { });

        res.json({ success: true, post });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put('/scheduled-posts/:id', async (req, res) => {
    try {
        const posts = await readJSON(SCHEDULED_POSTS_FILE) || [];
        const idx = posts.findIndex(p => p.id === req.params.id);
        if (idx === -1) return res.status(404).json({ success: false, message: 'Scheduled post not found' });
        if (posts[idx].status !== 'pending' && posts[idx].status !== 'scheduled') {
            return res.status(400).json({ success: false, message: 'Can only edit pending posts' });
        }

        const allowed = ['caption', 'scheduledAt', 'shareToFeed', 'collaborators', 'audioName',
            'thumbOffset', 'locationId', 'userTags', 'altText', 'coverUrl'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) posts[idx][key] = req.body[key];
        }
        if (req.body.scheduledAt) posts[idx].scheduledAt = new Date(req.body.scheduledAt).toISOString();

        await writeJSON(SCHEDULED_POSTS_FILE, posts);
        syncEverythingToGitHub().catch(() => { });
        res.json({ success: true, post: posts[idx] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/scheduled-posts', async (_req, res) => {
    try {
        let posts = await readJSON(SCHEDULED_POSTS_FILE) || [];
        const publishing = posts.filter(p => p.status === 'publishing');
        await writeJSON(SCHEDULED_POSTS_FILE, publishing);
        syncEverythingToGitHub().catch(() => { });
        res.json({ success: true, deleted: posts.length - publishing.length, kept: publishing.length });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/scheduled-posts/:id', async (req, res) => {
    try {
        let posts = await readJSON(SCHEDULED_POSTS_FILE) || [];
        const post = posts.find(p => p.id === req.params.id);
        if (!post) return res.status(404).json({ success: false, message: 'Scheduled post not found' });
        if (post.status === 'publishing') {
            return res.status(400).json({ success: false, message: 'Cannot delete a post that is currently publishing' });
        }
        posts = posts.filter(p => p.id !== req.params.id);
        await writeJSON(SCHEDULED_POSTS_FILE, posts);
        syncEverythingToGitHub().catch(() => { });
        res.json({ success: true, message: 'Scheduled post deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/process-scheduled', async (req, res) => {
    const result = await processScheduledPosts();
    res.json({ success: true, ...result, timestamp: new Date().toISOString() });
});

router.post('/process-scheduled', async (req, res) => {
    const result = await processScheduledPosts();
    res.json({ success: true, ...result, timestamp: new Date().toISOString() });
});

module.exports = router;
