import { Hono } from 'hono';
import { getAccountById } from '../lib/db.ts';
import { buildMediaParams } from '../services/instagram/instagramPublishing.ts';
import type { AppEnv } from '../types/app.ts';
import type { InstagramApiContainerStatus, InstagramApiErrorBody, InstagramApiIdResponse } from '../services/instagram/instagramApi.ts';
import type {
    CloudinaryConfigResponse, InstagramContainerStatusResponse, InstagramMediaPublishRequest, InstagramMediaPublishResponse,
    InstagramPublishingLimit, InstagramPublishingLimitResponse, InstagramPublishRequest, InstagramPublishResponse,
} from '../../shared/types/instagram.ts';

interface InstagramApiPublishingLimitBody extends InstagramApiErrorBody {
    data: InstagramPublishingLimit[];
}

const NO_TOKEN_MESSAGE = 'No Instagram access token stored - reconnect this account';

const app = new Hono<AppEnv>();

app.get('/cloudinary-config', (c) => {
    const cloudName = c.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = c.env.CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
        return c.json({ success: false, message: 'Cloudinary not configured on server' }, 503);
    }
    return c.json({ success: true, cloudName, uploadPreset } satisfies CloudinaryConfigResponse);
});

app.get('/accounts/:id/ig-publishing-limit', async (c) => {
    try {
        const acct = await getAccountById(c.get('supabase'), c.req.param('id'), c.get('userId'));
        if (!acct || acct.platform !== 'instagram') {
            return c.json({ success: false, message: 'Instagram account not found' }, 404);
        }
        if (!acct.accessToken || !acct.igUserId) return c.json({ success: false, message: NO_TOKEN_MESSAGE }, 400);
        const response = await fetch(
            `https://graph.instagram.com/v25.0/${acct.igUserId}/content_publishing_limit?fields=quota_usage,config&access_token=${acct.accessToken}`
        );
        const data = await response.json() as InstagramApiPublishingLimitBody;
        if (data.error) throw new Error(data.error.message);
        return c.json({ success: true, ...data } satisfies InstagramPublishingLimitResponse);
    } catch (err) {
        return c.json({ success: false, message: (err as Error).message }, 500);
    }
});

app.post('/accounts/:id/ig-publish', async (c) => {
    try {
        const acct = await getAccountById(c.get('supabase'), c.req.param('id'), c.get('userId'));
        if (!acct || acct.platform !== 'instagram') {
            return c.json({ success: false, message: 'Instagram account not found' }, 404);
        }
        if (!acct.accessToken || !acct.igUserId) return c.json({ success: false, message: NO_TOKEN_MESSAGE }, 400);

        const igId = acct.igUserId;
        const params = buildMediaParams(await c.req.json() as InstagramPublishRequest, acct.accessToken);

        // URLSearchParams stringifies the boolean and number values
        const query = new URLSearchParams(params as unknown as Record<string, string>).toString();
        const response = await fetch(`https://graph.instagram.com/v25.0/${igId}/media?${query}`, { method: 'POST' });
        const data = await response.json() as InstagramApiIdResponse;
        if (data.error) throw new Error(data.error.message);

        return c.json({ success: true, containerId: data.id } satisfies InstagramPublishResponse);
    } catch (err) {
        return c.json({ success: false, message: (err as Error).message }, 500);
    }
});

app.get('/ig-container/:containerId/status', async (c) => {
    try {
        const containerId = c.req.param('containerId');
        const accountId = c.req.query('accountId');
        if (!accountId) return c.json({ success: false, message: 'accountId is required' }, 400);
        const acct = await getAccountById(c.get('supabase'), accountId, c.get('userId'));
        if (!acct || acct.platform !== 'instagram') {
            return c.json({ success: false, message: 'Instagram account not found' }, 404);
        }
        if (!acct.accessToken) return c.json({ success: false, message: NO_TOKEN_MESSAGE }, 400);

        const response = await fetch(
            `https://graph.instagram.com/v25.0/${containerId}?fields=status_code,status&access_token=${acct.accessToken}`
        );
        const data = await response.json() as InstagramApiContainerStatus;
        if (data.error) throw new Error(data.error.message);

        return c.json({ success: true, statusCode: data.status_code ?? 'IN_PROGRESS', status: data.status ?? '' } satisfies InstagramContainerStatusResponse);
    } catch (err) {
        return c.json({ success: false, message: (err as Error).message }, 500);
    }
});

app.post('/accounts/:id/ig-media-publish', async (c) => {
    try {
        const acct = await getAccountById(c.get('supabase'), c.req.param('id'), c.get('userId'));
        if (!acct || acct.platform !== 'instagram') {
            return c.json({ success: false, message: 'Instagram account not found' }, 404);
        }
        if (!acct.accessToken || !acct.igUserId) return c.json({ success: false, message: NO_TOKEN_MESSAGE }, 400);

        const { containerId } = await c.req.json() as InstagramMediaPublishRequest;
        const response = await fetch(
            `https://graph.instagram.com/v25.0/${acct.igUserId}/media_publish?creation_id=${containerId}&access_token=${acct.accessToken}`,
            { method: 'POST' }
        );
        const data = await response.json() as InstagramApiIdResponse;
        if (data.error) throw new Error(data.error.message);

        return c.json({ success: true, mediaId: data.id } satisfies InstagramMediaPublishResponse);
    } catch (err) {
        return c.json({ success: false, message: (err as Error).message }, 500);
    }
});

export default app;
