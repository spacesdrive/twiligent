import { Hono } from 'hono';
import { getAccounts, getAccountById, deleteAccount } from '../lib/db.ts';
import { deleteVideosCache, deleteIGCache, deleteRedditCache } from '../lib/cache.ts';
import { resolveChannelId, fetchChannelData } from '../services/youtube/youtubeChannels.ts';
import {
    addYouTubeAccount, addRedditAccount, addInstagramAccount, refreshInstagramToken,
} from '../services/accountConnect.ts';
import { refreshAccount, refreshAllAccounts } from '../services/accountRefresh.ts';
import { safeAccount } from '../lib/safeAccount.ts';
import type { AppContext, AppEnv } from '../types/app.ts';
import type { ServiceFailure } from '../services/accountConnect.ts';
import type {
    AccountListResponse, AccountRefreshAllResponse, AccountResponse, SuccessResponse, YouTubeAccountAddResponse,
} from '../../shared/types/domain.ts';
import type { ResolveChannelResponse } from '../../shared/types/youtube.ts';
import type { InstagramTokenRefreshResponse } from '../../shared/types/instagram.ts';

interface ChannelInputBody {
    input: string;
}

interface AddRedditAccountBody {
    username?: string;
    cookie?: string;
}

interface AddInstagramAccountBody {
    accessToken?: string;
}

const app = new Hono<AppEnv>();

function failureResponse(c: AppContext, failure: ServiceFailure) {
    return c.json({ success: false, message: failure.message }, failure.status);
}

app.get('/accounts', async (c) => {
    try {
        const accounts = await getAccounts(c.get('supabase'), c.get('userId'));
        return c.json(accounts.map(safeAccount) satisfies AccountListResponse);
    } catch (err) {
        return c.json({ success: false, message: (err as Error).message }, 500);
    }
});

app.post('/resolve-channel', async (c) => {
    try {
        const { input } = await c.req.json() as ChannelInputBody;
        const apiKey = c.env.YOUTUBE_API_KEY?.replace(/^\uFEFF/, '').trim();
        if (!apiKey) return c.json({ success: false, message: 'YouTube API key not configured on server' }, 400);
        const channelId = await resolveChannelId(input, apiKey);
        const channelData = await fetchChannelData(channelId, apiKey);
        return c.json({ success: true, data: channelData } satisfies ResolveChannelResponse);
    } catch (err) {
        return c.json({ success: false, message: (err as Error).message }, 400);
    }
});

app.post('/accounts', async (c) => {
    try {
        const { input } = await c.req.json() as ChannelInputBody;
        const apiKey = c.env.YOUTUBE_API_KEY?.replace(/^\uFEFF/, '').trim();
        if (!apiKey) return c.json({ success: false, message: 'YouTube API key not configured on server' }, 400);
        const account = await addYouTubeAccount(c.get('supabase'), c.get('userId'), input, apiKey);
        return c.json({ success: true, account } satisfies YouTubeAccountAddResponse);
    } catch (err) {
        return c.json({ success: false, message: (err as Error).message }, 400);
    }
});

app.post('/accounts/reddit', async (c) => {
    try {
        const { username, cookie } = await c.req.json() as AddRedditAccountBody;
        if (!username) return c.json({ success: false, message: 'Username is required' }, 400);
        if (!cookie) return c.json({ success: false, message: 'Session cookie is required - open reddit.com in your browser, copy the reddit_session value from DevTools (Application > Cookies > reddit.com), and paste it here' }, 400);
        const account = await addRedditAccount(c.get('supabase'), c.get('userId'), username, cookie);
        return c.json({ success: true, account: safeAccount(account) } satisfies AccountResponse);
    } catch (err) {
        return c.json({ success: false, message: (err as Error).message }, 400);
    }
});

app.post('/accounts/instagram', async (c) => {
    try {
        const { accessToken } = await c.req.json() as AddInstagramAccountBody;
        if (!accessToken) return c.json({ success: false, message: 'Access token is required' }, 400);
        const account = await addInstagramAccount(c.get('supabase'), c.get('userId'), accessToken, c.env.INSTAGRAM_APP_SECRET);
        return c.json({ success: true, account: safeAccount(account) } satisfies AccountResponse);
    } catch (err) {
        return c.json({ success: false, message: (err as Error).message }, 400);
    }
});

app.post('/accounts/refresh-all', async (c) => {
    try {
        const { accounts, results } = await refreshAllAccounts(c.get('supabase'), c.get('userId'), c.env.YOUTUBE_API_KEY);
        return c.json({
            success: true,
            accounts: accounts.map(safeAccount),
            results,
            updatedAt: new Date().toISOString(),
        } satisfies AccountRefreshAllResponse);
    } catch (err) {
        return c.json({ success: false, message: (err as Error).message }, 500);
    }
});

app.post('/accounts/:id/refresh-ig-token', async (c) => {
    try {
        const outcome = await refreshInstagramToken(c.get('supabase'), c.get('userId'), c.req.param('id'));
        if (outcome.failure) return failureResponse(c, outcome.failure);
        return c.json({ success: true, message: 'Token refreshed for another 60 days', expiresAt: outcome.expiresAt } satisfies InstagramTokenRefreshResponse);
    } catch (err) {
        return c.json({ success: false, message: (err as Error).message }, 400);
    }
});

app.post('/accounts/:id/refresh', async (c) => {
    try {
        const outcome = await refreshAccount(c.get('supabase'), c.get('userId'), c.req.param('id'), c.env.YOUTUBE_API_KEY);
        if (outcome.failure) return failureResponse(c, outcome.failure);
        return c.json({ success: true, account: safeAccount(outcome.account) } satisfies AccountResponse);
    } catch (err) {
        return c.json({ success: false, message: (err as Error).message }, 400);
    }
});

app.delete('/accounts/:id', async (c) => {
    try {
        const supabase = c.get('supabase');
        const redis = c.get('redis');
        const userId = c.get('userId');
        const id = c.req.param('id');
        const account = await getAccountById(supabase, id, userId);
        if (!account) return c.json({ success: false, message: 'Not found' }, 404);
        await Promise.all([
            deleteAccount(supabase, id, userId),
            deleteVideosCache(redis, userId, id),
            deleteIGCache(redis, userId, id),
            deleteRedditCache(redis, userId, id),
        ]);
        return c.json({ success: true } satisfies SuccessResponse);
    } catch (err) {
        return c.json({ success: false, message: (err as Error).message }, 500);
    }
});

export default app;
