import { Hono } from 'hono';
import { getAccountById } from '../lib/db.js';

const app = new Hono();

app.get('/cloudinary-config', (c) => {
    const cloudName = c.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = c.env.CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
        return c.json({ success: false, message: 'Cloudinary not configured on server' });
    }
    return c.json({ success: true, cloudName, uploadPreset });
});

app.get('/accounts/:id/ig-publishing-limit', async (c) => {
    try {
        const acct = await getAccountById(c.get('supabase'), c.req.param('id'), c.get('userId'));
        if (!acct || acct.platform !== 'instagram') {
            return c.json({ success: false, message: 'Instagram account not found' }, 404);
        }
        const r = await fetch(
            `https://graph.instagram.com/v25.0/${acct.igUserId}/content_publishing_limit?fields=quota_usage,config&access_token=${acct.accessToken}`
        );
        const data = await r.json();
        if (data.error) throw new Error(data.error.message);
        return c.json({ success: true, ...data });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});

app.post('/accounts/:id/ig-publish', async (c) => {
    try {
        const acct = await getAccountById(c.get('supabase'), c.req.param('id'), c.get('userId'));
        if (!acct || acct.platform !== 'instagram') {
            return c.json({ success: false, message: 'Instagram account not found' }, 404);
        }

        const {
            mediaType, mediaUrl, caption, coverUrl, shareToFeed, collaborators,
            audioName, thumbOffset, locationId, userTags, altText, children,
        } = await c.req.json();

        const igId = acct.igUserId;
        const token = acct.accessToken;
        const params = { access_token: token };

        if (mediaType === 'CAROUSEL') {
            params.media_type = 'CAROUSEL';
            if (caption) params.caption = caption;
            if (children?.length) params.children = children.join(',');
            if (collaborators?.length) params.collaborators = JSON.stringify(collaborators);
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
            if (collaborators?.length) params.collaborators = JSON.stringify(collaborators);
            if (audioName) params.audio_name = audioName;
            if (thumbOffset != null) params.thumb_offset = thumbOffset;
            if (locationId) params.location_id = locationId;
            if (userTags?.length) params.user_tags = JSON.stringify(userTags);
        } else if (mediaType === 'STORIES') {
            params.media_type = 'STORIES';
            if (mediaUrl?.match(/\.(mp4|mov|avi|webm)/i)) {
                params.video_url = mediaUrl;
            } else {
                params.image_url = mediaUrl;
            }
            if (userTags?.length) params.user_tags = JSON.stringify(userTags);
        } else {
            params.image_url = mediaUrl;
            if (caption) params.caption = caption;
            if (locationId) params.location_id = locationId;
            if (userTags?.length) params.user_tags = JSON.stringify(userTags);
            if (altText) params.alt_text = altText;
        }

        const qs = new URLSearchParams(params).toString();
        const r = await fetch(`https://graph.instagram.com/v25.0/${igId}/media?${qs}`, { method: 'POST' });
        const data = await r.json();
        if (data.error) throw new Error(data.error.message);

        return c.json({ success: true, containerId: data.id });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});

app.get('/ig-container/:containerId/status', async (c) => {
    try {
        const containerId = c.req.param('containerId');
        const accountId = c.req.query('accountId');
        const acct = await getAccountById(c.get('supabase'), accountId, c.get('userId'));
        if (!acct) return c.json({ success: false, message: 'Account not found' }, 404);

        const r = await fetch(
            `https://graph.instagram.com/v25.0/${containerId}?fields=status_code,status&access_token=${acct.accessToken}`
        );
        const data = await r.json();
        if (data.error) throw new Error(data.error.message);

        return c.json({ success: true, statusCode: data.status_code, status: data.status });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});

app.post('/accounts/:id/ig-media-publish', async (c) => {
    try {
        const acct = await getAccountById(c.get('supabase'), c.req.param('id'), c.get('userId'));
        if (!acct || acct.platform !== 'instagram') {
            return c.json({ success: false, message: 'Instagram account not found' }, 404);
        }

        const { containerId } = await c.req.json();
        const r = await fetch(
            `https://graph.instagram.com/v25.0/${acct.igUserId}/media_publish?creation_id=${containerId}&access_token=${acct.accessToken}`,
            { method: 'POST' }
        );
        const data = await r.json();
        if (data.error) throw new Error(data.error.message);

        return c.json({ success: true, mediaId: data.id });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});

export default app;
