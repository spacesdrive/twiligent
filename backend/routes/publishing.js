const router = require('express').Router();
const fetch = require('node-fetch');
const { readJSON, ACCOUNTS_FILE, API_KEYS_FILE } = require('../utils/dataHelpers');

router.get('/cloudinary-config', async (req, res) => {
    const keys = await readJSON(API_KEYS_FILE);
    const cloud = keys?.cloudinary || {};
    if (!cloud.cloudName || !cloud.uploadPreset) {
        return res.json({ success: false, message: 'Cloudinary not configured' });
    }
    res.json({ success: true, cloudName: cloud.cloudName, uploadPreset: cloud.uploadPreset });
});

router.get('/accounts/:id/ig-publishing-limit', async (req, res) => {
    try {
        const accounts = await readJSON(ACCOUNTS_FILE) || [];
        const acct = accounts.find(a => a.id === req.params.id);
        if (!acct || acct.platform !== 'instagram') {
            return res.status(404).json({ success: false, message: 'Instagram account not found' });
        }
        const r = await fetch(
            `https://graph.instagram.com/v25.0/${acct.igUserId}/content_publishing_limit?fields=quota_usage,config&access_token=${acct.accessToken}`
        );
        const data = await r.json();
        if (data.error) throw new Error(data.error.message);
        res.json({ success: true, ...data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/accounts/:id/ig-publish', async (req, res) => {
    try {
        const accounts = await readJSON(ACCOUNTS_FILE) || [];
        const acct = accounts.find(a => a.id === req.params.id);
        if (!acct || acct.platform !== 'instagram') {
            return res.status(404).json({ success: false, message: 'Instagram account not found' });
        }

        const {
            mediaType, mediaUrl, caption, coverUrl, shareToFeed, collaborators,
            audioName, thumbOffset, locationId, userTags, altText, children,
        } = req.body;

        const igId = acct.igUserId;
        const token = acct.accessToken;
        const params = { access_token: token };

        if (mediaType === 'CAROUSEL') {
            params.media_type = 'CAROUSEL';
            if (caption) params.caption = caption;
            if (children && children.length) params.children = children.join(',');
            if (collaborators && collaborators.length) params.collaborators = JSON.stringify(collaborators);
            if (locationId) params.location_id = locationId;
        } else if (mediaType === 'CAROUSEL_ITEM_IMAGE') {
            params.image_url = mediaUrl;
            params.is_carousel_item = true;
        } else if (mediaType === 'CAROUSEL_ITEM_VIDEO') {
            params.media_type = 'VIDEO';
            params.video_url = mediaUrl;
            params.is_carousel_item = true;
        } else if (mediaType === 'REELS') {
            params.media_type = 'REELS';
            params.video_url = mediaUrl;
            if (caption) params.caption = caption;
            if (shareToFeed !== undefined) params.share_to_feed = shareToFeed;
            if (coverUrl) params.cover_url = coverUrl;
            if (collaborators && collaborators.length) params.collaborators = JSON.stringify(collaborators);
            if (audioName) params.audio_name = audioName;
            if (thumbOffset != null) params.thumb_offset = thumbOffset;
            if (locationId) params.location_id = locationId;
            if (userTags && userTags.length) params.user_tags = JSON.stringify(userTags);
        } else if (mediaType === 'STORIES') {
            params.media_type = 'STORIES';
            if (mediaUrl && (mediaUrl.match(/\.(mp4|mov|avi|webm)/i))) {
                params.video_url = mediaUrl;
            } else {
                params.image_url = mediaUrl;
            }
            if (userTags && userTags.length) params.user_tags = JSON.stringify(userTags);
        } else {
            params.image_url = mediaUrl;
            if (caption) params.caption = caption;
            if (locationId) params.location_id = locationId;
            if (userTags && userTags.length) params.user_tags = JSON.stringify(userTags);
            if (altText) params.alt_text = altText;
        }

        const qs = new URLSearchParams(params).toString();
        const r = await fetch(`https://graph.instagram.com/v25.0/${igId}/media?${qs}`, { method: 'POST' });
        const data = await r.json();

        if (data.error) throw new Error(data.error.message);
        res.json({ success: true, containerId: data.id });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/ig-container/:containerId/status', async (req, res) => {
    try {
        const { containerId } = req.params;
        const { accountId } = req.query;
        const accounts = await readJSON(ACCOUNTS_FILE) || [];
        const acct = accounts.find(a => a.id === accountId);
        if (!acct) return res.status(404).json({ success: false, message: 'Account not found' });

        const r = await fetch(
            `https://graph.instagram.com/v25.0/${containerId}?fields=status_code,status&access_token=${acct.accessToken}`
        );
        const data = await r.json();
        if (data.error) throw new Error(data.error.message);

        res.json({ success: true, statusCode: data.status_code, status: data.status });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/accounts/:id/ig-media-publish', async (req, res) => {
    try {
        const accounts = await readJSON(ACCOUNTS_FILE) || [];
        const acct = accounts.find(a => a.id === req.params.id);
        if (!acct || acct.platform !== 'instagram') {
            return res.status(404).json({ success: false, message: 'Instagram account not found' });
        }

        const { containerId } = req.body;
        const r = await fetch(
            `https://graph.instagram.com/v25.0/${acct.igUserId}/media_publish?creation_id=${containerId}&access_token=${acct.accessToken}`,
            { method: 'POST' }
        );
        const data = await r.json();
        if (data.error) throw new Error(data.error.message);

        res.json({ success: true, mediaId: data.id });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
