import { Hono } from 'hono';
import {
    getAccounts, getAccountById, createAccount, updateAccount, deleteAccount,
} from '../lib/db.js';
import { deleteVideosCache, deleteIGCache, deleteRedditCache } from '../lib/cache.js';
import { encryptPassword } from '../lib/crypto.js';
import { fetchInstagramProfile, exchangeForLongLivedToken, refreshLongLivedToken } from '../services/instagram.js';
import { resolveChannelId, fetchChannelData } from '../services/youtube.js';
import { fetchRedditProfile, loginToReddit, safeRedditAccount } from '../services/reddit.js';

const app = new Hono();

function safeAccount(account) {
    const copy = { ...account };
    delete copy.accessToken;
    delete copy.cookie;
    delete copy.encryptedPassword;
    return copy;
}

app.get('/accounts', async (c) => {
    try {
        const accounts = await getAccounts(c.get('supabase'), c.get('userId'));
        return c.json(accounts.map(safeAccount));
    } catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});

app.post('/resolve-channel', async (c) => {
    try {
        const { input } = await c.req.json();
        const apiKey = c.env.YOUTUBE_API_KEY?.replace(/^﻿/, '').trim();
        if (!apiKey) return c.json({ success: false, message: 'YouTube API key not configured on server' }, 400);
        const channelId = await resolveChannelId(input, apiKey);
        const channelData = await fetchChannelData(channelId, apiKey);
        return c.json({ success: true, data: channelData });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 400);
    }
});

app.post('/accounts', async (c) => {
    try {
        const { input } = await c.req.json();
        const supabase = c.get('supabase');
        const userId = c.get('userId');
        const apiKey = c.env.YOUTUBE_API_KEY?.replace(/^﻿/, '').trim();
        if (!apiKey) return c.json({ success: false, message: 'YouTube API key not configured on server' }, 400);

        const channelId = await resolveChannelId(input, apiKey);
        const [channelData, accounts] = await Promise.all([
            fetchChannelData(channelId, apiKey),
            getAccounts(supabase, userId),
        ]);

        if (accounts.find(a => a.channelId === channelId)) {
            return c.json({ success: false, message: 'This channel is already added' }, 400);
        }

        const newAccount = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            channelId: channelData.channelId,
            title: channelData.title,
            description: channelData.description,
            customUrl: channelData.customUrl,
            publishedAt: channelData.publishedAt,
            country: channelData.country,
            thumbnails: channelData.thumbnails,
            subscriberCount: channelData.subscriberCount,
            viewCount: channelData.viewCount,
            videoCount: channelData.videoCount,
            hiddenSubscriberCount: channelData.hiddenSubscriberCount,
            uploadsPlaylistId: channelData.uploadsPlaylistId,
            keywords: channelData.keywords,
            topicCategories: channelData.topicCategories,
            madeForKids: channelData.madeForKids,
            addedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
        };

        await createAccount(supabase, newAccount, userId);
        return c.json({ success: true, account: newAccount });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 400);
    }
});

app.post('/accounts/reddit', async (c) => {
    try {
        const { username, password } = await c.req.json();
        if (!username) return c.json({ success: false, message: 'Username is required' }, 400);

        const supabase = c.get('supabase');
        const userId = c.get('userId');
        const cleanUsername = username.replace(/^u\//i, '').trim();

        let cookieData = {};
        let encryptedPassword = null;

        if (password) {
            const encKey = c.env.REDDIT_ENCRYPTION_KEY;
            if (!encKey) {
                return c.json({ success: false, message: 'REDDIT_ENCRYPTION_KEY is not configured on the server - run: wrangler secret put REDDIT_ENCRYPTION_KEY' }, 500);
            }
            const loginResult = await loginToReddit(cleanUsername, password);
            cookieData = loginResult;
            encryptedPassword = await encryptPassword(password, encKey);
        }

        const profile = await fetchRedditProfile(cleanUsername, cookieData.cookie ?? null);

        const accounts = await getAccounts(supabase, userId);
        if (accounts.find(a => a.platform === 'reddit' && a.username === profile.username)) {
            return c.json({ success: false, message: 'This Reddit account is already added' }, 400);
        }

        const newAccount = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            platform: 'reddit',
            username: profile.username,
            title: `u/${profile.username}`,
            totalKarma: profile.totalKarma,
            postKarma: profile.postKarma,
            commentKarma: profile.commentKarma,
            iconUrl: profile.iconUrl,
            createdAt: profile.createdAt,
            encryptedPassword,
            ...cookieData,
            addedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
        };

        await createAccount(supabase, newAccount, userId);
        return c.json({ success: true, account: safeRedditAccount(newAccount) });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 400);
    }
});

app.post('/accounts/instagram', async (c) => {
    try {
        const { accessToken } = await c.req.json();
        if (!accessToken) return c.json({ success: false, message: 'Access token is required' }, 400);

        const supabase = c.get('supabase');
        const userId = c.get('userId');
        const appSecret = c.env.INSTAGRAM_APP_SECRET;

        let finalToken = accessToken;
        let expiresIn = 0;
        if (appSecret) {
            try {
                const longToken = await exchangeForLongLivedToken(accessToken, appSecret);
                finalToken = longToken.accessToken;
                expiresIn = longToken.expiresIn;
            } catch (err) {
                console.log('Token exchange skipped (token may already be long-lived):', err.message);
            }
        }

        const profile = await fetchInstagramProfile(null, finalToken);
        if (!profile.igUserId) {
            throw new Error('Could not get Instagram User ID. Make sure the token has instagram_business_basic permission and is from a Business/Creator account.');
        }

        const accounts = await getAccounts(supabase, userId);
        if (accounts.find(a => a.platform === 'instagram' && a.igUserId === profile.igUserId)) {
            return c.json({ success: false, message: 'This Instagram account is already added' }, 400);
        }

        const newAccount = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            platform: 'instagram',
            igUserId: profile.igUserId,
            username: profile.username,
            title: profile.name || profile.username,
            biography: profile.biography,
            website: profile.website,
            profilePictureUrl: profile.profilePictureUrl,
            followersCount: profile.followersCount,
            followsCount: profile.followsCount,
            mediaCount: profile.mediaCount,
            accessToken: finalToken,
            tokenExpiresAt: expiresIn > 0
                ? new Date(Date.now() + expiresIn * 1000).toISOString()
                : null,
            addedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
        };

        await createAccount(supabase, newAccount, userId);
        return c.json({ success: true, account: safeAccount(newAccount) });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 400);
    }
});

app.post('/accounts/refresh-all', async (c) => {
    try {
        const supabase = c.get('supabase');
        const userId = c.get('userId');
        const apiKey = c.env.YOUTUBE_API_KEY;
        const accounts = await getAccounts(supabase, userId);
        const settled = await Promise.allSettled(accounts.map(async (account) => {
            let updates = { lastUpdated: new Date().toISOString() };
            if (account.platform === 'instagram') {
                if (!account.accessToken) throw new Error('No access token');
                const profile = await fetchInstagramProfile(account.igUserId, account.accessToken);
                updates = {
                    ...updates,
                    followersCount: profile.followersCount,
                    followsCount: profile.followsCount,
                    mediaCount: profile.mediaCount,
                    title: profile.name || profile.username,
                    username: profile.username,
                    profilePictureUrl: profile.profilePictureUrl,
                };
            } else if (account.platform === 'reddit') {
                const profile = await fetchRedditProfile(account.username, account.cookie ?? null);
                updates = {
                    ...updates,
                    totalKarma: profile.totalKarma,
                    postKarma: profile.postKarma,
                    commentKarma: profile.commentKarma,
                    iconUrl: profile.iconUrl,
                };
            } else {
                if (!apiKey) throw new Error('No YouTube API key');
                const channelData = await fetchChannelData(account.channelId, apiKey);
                updates = {
                    ...updates,
                    subscriberCount: channelData.subscriberCount,
                    viewCount: channelData.viewCount,
                    videoCount: channelData.videoCount,
                    title: channelData.title,
                    thumbnails: channelData.thumbnails,
                };
            }
            await updateAccount(supabase, account.id, updates, userId);
            return account.id;
        }));

        const results = settled.map((r, i) =>
            r.status === 'fulfilled'
                ? { id: accounts[i].id, success: true }
                : { id: accounts[i].id, success: false, error: r.reason?.message }
        );

        const updatedAccounts = await getAccounts(supabase, userId);
        return c.json({
            success: true,
            accounts: updatedAccounts.map(safeAccount),
            results,
            updatedAt: new Date().toISOString(),
        });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});

app.post('/accounts/:id/refresh-ig-token', async (c) => {
    try {
        const supabase = c.get('supabase');
        const userId = c.get('userId');
        const account = await getAccountById(supabase, c.req.param('id'), userId);
        if (!account || account.platform !== 'instagram') {
            return c.json({ success: false, message: 'Instagram account not found' }, 404);
        }
        if (!account.accessToken) {
            return c.json({ success: false, message: 'No access token stored' }, 400);
        }
        const refreshed = await refreshLongLivedToken(account.accessToken);
        const tokenExpiresAt = new Date(Date.now() + (refreshed.expiresIn || 5184000) * 1000).toISOString();
        await updateAccount(supabase, account.id, { accessToken: refreshed.accessToken, tokenExpiresAt }, userId);
        return c.json({ success: true, message: 'Token refreshed for another 60 days', expiresAt: tokenExpiresAt });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 400);
    }
});

app.post('/accounts/:id/refresh', async (c) => {
    try {
        const supabase = c.get('supabase');
        const userId = c.get('userId');
        const account = await getAccountById(supabase, c.req.param('id'), userId);
        if (!account) return c.json({ success: false, message: 'Not found' }, 404);

        let updates = { lastUpdated: new Date().toISOString() };

        if (account.platform === 'instagram') {
            if (!account.accessToken) return c.json({ success: false, message: 'No access token' }, 400);
            const profile = await fetchInstagramProfile(account.igUserId, account.accessToken);
            updates = {
                ...updates,
                followersCount: profile.followersCount,
                followsCount: profile.followsCount,
                mediaCount: profile.mediaCount,
                title: profile.name || profile.username,
                username: profile.username,
                profilePictureUrl: profile.profilePictureUrl,
                biography: profile.biography,
                website: profile.website,
            };
        } else if (account.platform === 'reddit') {
            const profile = await fetchRedditProfile(account.username, account.cookie ?? null);
            updates = {
                ...updates,
                totalKarma: profile.totalKarma,
                postKarma: profile.postKarma,
                commentKarma: profile.commentKarma,
                iconUrl: profile.iconUrl,
            };
        } else {
            const apiKey = c.env.YOUTUBE_API_KEY;
            if (!apiKey) return c.json({ success: false, message: 'No API key' }, 400);
            const channelData = await fetchChannelData(account.channelId, apiKey);
            updates = {
                ...updates,
                subscriberCount: channelData.subscriberCount,
                viewCount: channelData.viewCount,
                videoCount: channelData.videoCount,
                title: channelData.title,
                description: channelData.description,
                thumbnails: channelData.thumbnails,
                customUrl: channelData.customUrl,
                country: channelData.country,
                keywords: channelData.keywords,
                topicCategories: channelData.topicCategories,
            };
        }

        await updateAccount(supabase, account.id, updates, userId);
        return c.json({ success: true, account: safeAccount({ ...account, ...updates }) });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 400);
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
        return c.json({ success: true });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});

export default app;
