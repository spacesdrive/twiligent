const router = require('express').Router();
const { readJSON, writeJSON, ACCOUNTS_FILE, VIDEOS_CACHE_FILE, IG_CACHE_FILE, getAPIKey, getIGAppCredentials } = require('../utils/dataHelpers');
const { syncEverythingToGitHub } = require('../services/github');
const { fetchInstagramProfile, exchangeForLongLivedToken, refreshLongLivedToken } = require('../services/instagram');
const { resolveChannelId, fetchChannelData } = require('../services/youtube');

router.get('/accounts', async (req, res) => {
    const accounts = await readJSON(ACCOUNTS_FILE) || [];
    const safe = accounts.map(a => {
        const copy = { ...a };
        if (copy.accessToken) delete copy.accessToken;
        return copy;
    });
    res.json(safe);
});

router.post('/resolve-channel', async (req, res) => {
    try {
        const { input } = req.body;
        const apiKey = await getAPIKey();
        if (!apiKey) return res.status(400).json({ success: false, message: 'YouTube API key not configured' });

        const channelId = await resolveChannelId(input, apiKey);
        const channelData = await fetchChannelData(channelId, apiKey);
        res.json({ success: true, data: channelData });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

router.post('/accounts', async (req, res) => {
    try {
        const { input } = req.body;
        const apiKey = await getAPIKey();
        if (!apiKey) return res.status(400).json({ success: false, message: 'YouTube API key not configured' });

        const channelId = await resolveChannelId(input, apiKey);
        const channelData = await fetchChannelData(channelId, apiKey);
        const accounts = await readJSON(ACCOUNTS_FILE);

        if (accounts.find(a => a.channelId === channelId)) {
            return res.status(400).json({ success: false, message: 'This channel is already added' });
        }

        const newAccount = {
            id: Date.now().toString(),
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

        accounts.push(newAccount);
        await writeJSON(ACCOUNTS_FILE, accounts);
        syncEverythingToGitHub().catch(() => { });

        res.json({ success: true, account: newAccount });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

router.post('/accounts/instagram', async (req, res) => {
    try {
        const { accessToken } = req.body;
        if (!accessToken) return res.status(400).json({ success: false, message: 'Access token is required' });

        const { appSecret } = await getIGAppCredentials();

        let finalToken = accessToken;
        let expiresIn = 0;
        if (appSecret) {
            try {
                const longToken = await exchangeForLongLivedToken(accessToken, appSecret);
                finalToken = longToken.accessToken;
                expiresIn = longToken.expiresIn;
                console.log('Token exchanged for long-lived token successfully');
            } catch (err) {
                console.log('Token exchange skipped (token may already be long-lived):', err.message);
            }
        } else {
            console.log('No Instagram App Secret configured — using token as-is');
        }

        const profile = await fetchInstagramProfile(null, finalToken);

        if (!profile.igUserId) {
            throw new Error('Could not get Instagram User ID. Make sure the token has instagram_business_basic permission and is from a Business/Creator account.');
        }

        const accounts = await readJSON(ACCOUNTS_FILE);

        if (accounts.find(a => a.platform === 'instagram' && a.igUserId === profile.igUserId)) {
            return res.status(400).json({ success: false, message: 'This Instagram account is already added' });
        }

        const newAccount = {
            id: Date.now().toString(),
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

        accounts.push(newAccount);
        await writeJSON(ACCOUNTS_FILE, accounts);
        syncEverythingToGitHub().catch(() => { });

        const safeAccount = { ...newAccount };
        delete safeAccount.accessToken;
        res.json({ success: true, account: safeAccount });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

router.post('/accounts/refresh-all', async (req, res) => {
    try {
        const apiKey = await getAPIKey();
        const accounts = await readJSON(ACCOUNTS_FILE);
        const results = [];

        for (const account of accounts) {
            try {
                if (account.platform === 'instagram') {
                    if (!account.accessToken) throw new Error('No access token');
                    const profile = await fetchInstagramProfile(account.igUserId, account.accessToken);
                    account.followersCount = profile.followersCount;
                    account.followsCount = profile.followsCount;
                    account.mediaCount = profile.mediaCount;
                    account.title = profile.name || profile.username;
                    account.username = profile.username;
                    account.profilePictureUrl = profile.profilePictureUrl;
                } else {
                    if (!apiKey) throw new Error('No YouTube API key');
                    const channelData = await fetchChannelData(account.channelId, apiKey);
                    account.subscriberCount = channelData.subscriberCount;
                    account.viewCount = channelData.viewCount;
                    account.videoCount = channelData.videoCount;
                    account.title = channelData.title;
                    account.thumbnails = channelData.thumbnails;
                }
                account.lastUpdated = new Date().toISOString();
                results.push({ id: account.id, success: true });
            } catch (err) {
                results.push({ id: account.id, success: false, error: err.message });
            }
        }

        await writeJSON(ACCOUNTS_FILE, accounts);
        const safeAccounts = accounts.map(a => {
            const safe = { ...a };
            if (safe.accessToken) delete safe.accessToken;
            return safe;
        });
        res.json({ success: true, accounts: safeAccounts, results, updatedAt: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/accounts/:id/refresh-ig-token', async (req, res) => {
    try {
        const accounts = await readJSON(ACCOUNTS_FILE);
        const account = accounts.find(a => a.id === req.params.id && a.platform === 'instagram');
        if (!account) return res.status(404).json({ success: false, message: 'Instagram account not found' });
        if (!account.accessToken) return res.status(400).json({ success: false, message: 'No access token stored' });

        const refreshed = await refreshLongLivedToken(account.accessToken);
        account.accessToken = refreshed.accessToken;
        account.tokenExpiresAt = new Date(Date.now() + (refreshed.expiresIn || 5184000) * 1000).toISOString();
        await writeJSON(ACCOUNTS_FILE, accounts);
        syncEverythingToGitHub().catch(() => { });
        res.json({ success: true, message: 'Token refreshed for another 60 days', expiresAt: account.tokenExpiresAt });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

router.post('/accounts/:id/refresh', async (req, res) => {
    try {
        const accounts = await readJSON(ACCOUNTS_FILE);
        const account = accounts.find(a => a.id === req.params.id);
        if (!account) return res.status(404).json({ success: false, message: 'Not found' });

        if (account.platform === 'instagram') {
            if (!account.accessToken) return res.status(400).json({ success: false, message: 'No access token' });
            const profile = await fetchInstagramProfile(account.igUserId, account.accessToken);
            account.followersCount = profile.followersCount;
            account.followsCount = profile.followsCount;
            account.mediaCount = profile.mediaCount;
            account.title = profile.name || profile.username;
            account.username = profile.username;
            account.profilePictureUrl = profile.profilePictureUrl;
            account.biography = profile.biography;
            account.website = profile.website;
        } else {
            const apiKey = await getAPIKey();
            if (!apiKey) return res.status(400).json({ success: false, message: 'No API key' });
            const channelData = await fetchChannelData(account.channelId, apiKey);
            account.subscriberCount = channelData.subscriberCount;
            account.viewCount = channelData.viewCount;
            account.videoCount = channelData.videoCount;
            account.title = channelData.title;
            account.description = channelData.description;
            account.thumbnails = channelData.thumbnails;
            account.customUrl = channelData.customUrl;
            account.country = channelData.country;
            account.keywords = channelData.keywords;
            account.topicCategories = channelData.topicCategories;
        }
        account.lastUpdated = new Date().toISOString();
        await writeJSON(ACCOUNTS_FILE, accounts);

        const safeAccount = { ...account };
        if (safeAccount.accessToken) delete safeAccount.accessToken;
        res.json({ success: true, account: safeAccount });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

router.delete('/accounts/:id', async (req, res) => {
    try {
        const accounts = await readJSON(ACCOUNTS_FILE);
        const account = accounts.find(a => a.id === req.params.id);
        if (!account) return res.status(404).json({ success: false, message: 'Not found' });
        const filtered = accounts.filter(a => a.id !== req.params.id);
        await writeJSON(ACCOUNTS_FILE, filtered);
        syncEverythingToGitHub().catch(() => { });

        const cache = await readJSON(VIDEOS_CACHE_FILE);
        delete cache[req.params.id];
        await writeJSON(VIDEOS_CACHE_FILE, cache);

        const igCache = await readJSON(IG_CACHE_FILE) || {};
        delete igCache[req.params.id];
        await writeJSON(IG_CACHE_FILE, igCache);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
