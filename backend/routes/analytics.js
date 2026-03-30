const router = require('express').Router();
const { readJSON, writeJSON, ACCOUNTS_FILE, VIDEOS_CACHE_FILE, IG_CACHE_FILE, getAPIKey } = require('../utils/dataHelpers');
const { fetchAllVideos, fetchChannelData, computeVideoAnalytics } = require('../services/youtube');
const { fetchInstagramProfile, fetchInstagramMedia, computeInstagramAnalytics } = require('../services/instagram');

router.get('/accounts/:id/analytics', async (req, res) => {
    try {
        const apiKey = await getAPIKey();
        if (!apiKey) return res.status(400).json({ success: false, message: 'No API key' });

        const accounts = await readJSON(ACCOUNTS_FILE);
        const account = accounts.find(a => a.id === req.params.id);
        if (!account) return res.status(404).json({ success: false, message: 'Not found' });

        const videos = await fetchAllVideos(account.uploadsPlaylistId, apiKey, 10);

        const cache = await readJSON(VIDEOS_CACHE_FILE) || {};
        cache[req.params.id] = { videos, fetchedAt: new Date().toISOString() };
        await writeJSON(VIDEOS_CACHE_FILE, cache);

        const analytics = computeVideoAnalytics(videos);

        if (!account.publishedAt) {
            try {
                const channelData = await fetchChannelData(account.channelId, apiKey);
                account.publishedAt = channelData.publishedAt;
                account.subscriberCount = channelData.subscriberCount;
                account.viewCount = channelData.viewCount;
                account.videoCount = channelData.videoCount;
                account.title = channelData.title;
                account.thumbnails = channelData.thumbnails;
                account.customUrl = channelData.customUrl;
                account.country = channelData.country;
                account.lastUpdated = new Date().toISOString();
                await writeJSON(ACCOUNTS_FILE, accounts);
            } catch (e) {
                console.error('Failed to backfill channel data:', e.message);
            }
        }

        const channelAge = account.publishedAt
            ? Math.floor((Date.now() - new Date(account.publishedAt).getTime()) / 86400000)
            : 365;
        const viewsPerSub = account.subscriberCount > 0 ? (account.viewCount / account.subscriberCount).toFixed(1) : 0;
        const subsPerView = account.viewCount > 0 ? (account.subscriberCount / account.viewCount * 100).toFixed(4) : 0;
        const avgViewsPerVideo = account.videoCount > 0 ? Math.round(account.viewCount / account.videoCount) : 0;
        const avgSubGainPerDay = channelAge > 0 ? Math.round(account.subscriberCount / channelAge) : 0;
        const avgViewsPerDay = channelAge > 0 ? Math.round(account.viewCount / channelAge) : 0;

        res.json({
            success: true,
            channel: {
                ...account,
                channelAge,
                channelAgeYears: (channelAge / 365).toFixed(1),
                viewsPerSubscriber: parseFloat(viewsPerSub),
                subscriberToViewRatio: parseFloat(subsPerView),
                avgViewsPerVideo,
                avgSubGainPerDay,
                avgViewsPerDay,
                estimatedMonthlyViews: avgViewsPerDay * 30,
                estimatedMonthlySubGain: avgSubGainPerDay * 30,
                estimatedYearlyViews: avgViewsPerDay * 365,
                estimatedYearlySubGain: avgSubGainPerDay * 365,
            },
            analytics,
            videoCount: videos.length,
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

router.get('/accounts/:id/videos', async (req, res) => {
    try {
        const cache = await readJSON(VIDEOS_CACHE_FILE) || {};
        const accountCache = cache[req.params.id];

        if (accountCache && accountCache.videos) {
            return res.json({ success: true, videos: accountCache.videos, fetchedAt: accountCache.fetchedAt });
        }

        const apiKey = await getAPIKey();
        if (!apiKey) return res.status(400).json({ success: false, message: 'No API key' });

        const accounts = await readJSON(ACCOUNTS_FILE);
        const account = accounts.find(a => a.id === req.params.id);
        if (!account) return res.status(404).json({ success: false, message: 'Not found' });

        const videos = await fetchAllVideos(account.uploadsPlaylistId, apiKey, 10);
        cache[req.params.id] = { videos, fetchedAt: new Date().toISOString() };
        await writeJSON(VIDEOS_CACHE_FILE, cache);

        res.json({ success: true, videos, fetchedAt: cache[req.params.id].fetchedAt });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

router.get('/comparison', async (req, res) => {
    try {
        const accounts = await readJSON(ACCOUNTS_FILE);
        if (accounts.length === 0) return res.json({ success: true, comparison: null });

        const sorted = {
            bySubscribers: [...accounts].sort((a, b) => b.subscriberCount - a.subscriberCount),
            byViews: [...accounts].sort((a, b) => b.viewCount - a.viewCount),
            byVideos: [...accounts].sort((a, b) => b.videoCount - a.videoCount),
        };

        const totals = accounts.reduce((acc, a) => ({
            subscribers: acc.subscribers + a.subscriberCount,
            views: acc.views + a.viewCount,
            videos: acc.videos + a.videoCount,
        }), { subscribers: 0, views: 0, videos: 0 });

        res.json({
            success: true,
            comparison: {
                rankings: sorted,
                totals,
                accountCount: accounts.length,
                bestBySubscribers: sorted.bySubscribers[0] || null,
                bestByViews: sorted.byViews[0] || null,
                bestByVideos: sorted.byVideos[0] || null,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/accounts/:id/ig-analytics', async (req, res) => {
    try {
        const accounts = await readJSON(ACCOUNTS_FILE);
        const account = accounts.find(a => a.id === req.params.id && a.platform === 'instagram');
        if (!account) return res.status(404).json({ success: false, message: 'Instagram account not found' });
        if (!account.accessToken) return res.status(400).json({ success: false, message: 'No access token stored' });

        const profile = await fetchInstagramProfile(account.igUserId, account.accessToken);
        const media = await fetchInstagramMedia(account.igUserId, account.accessToken, 500);

        const igCache = await readJSON(IG_CACHE_FILE) || {};
        igCache[req.params.id] = { media, fetchedAt: new Date().toISOString() };
        await writeJSON(IG_CACHE_FILE, igCache);

        const analytics = computeInstagramAnalytics(profile, media);

        account.followersCount = profile.followersCount;
        account.followsCount = profile.followsCount;
        account.mediaCount = profile.mediaCount;
        account.profilePictureUrl = profile.profilePictureUrl;
        account.lastUpdated = new Date().toISOString();
        await writeJSON(ACCOUNTS_FILE, accounts);

        const safeAccount = { ...account };
        delete safeAccount.accessToken;

        res.json({
            success: true,
            profile: { ...profile },
            account: safeAccount,
            analytics,
            mediaCount: media.length,
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

router.get('/accounts/:id/ig-media', async (req, res) => {
    try {
        const igCache = await readJSON(IG_CACHE_FILE) || {};
        const cached = igCache[req.params.id];
        if (cached && cached.media) {
            return res.json({ success: true, media: cached.media, fetchedAt: cached.fetchedAt });
        }

        const accounts = await readJSON(ACCOUNTS_FILE);
        const account = accounts.find(a => a.id === req.params.id && a.platform === 'instagram');
        if (!account) return res.status(404).json({ success: false, message: 'Not found' });
        if (!account.accessToken) return res.status(400).json({ success: false, message: 'No access token' });

        const media = await fetchInstagramMedia(account.igUserId, account.accessToken, 500);
        igCache[req.params.id] = { media, fetchedAt: new Date().toISOString() };
        await writeJSON(IG_CACHE_FILE, igCache);

        res.json({ success: true, media, fetchedAt: igCache[req.params.id].fetchedAt });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

router.get('/videos/all', async (req, res) => {
    try {
        const { channelId, sort, order, search, minViews, maxViews } = req.query;
        const cache = await readJSON(VIDEOS_CACHE_FILE) || {};
        const accounts = await readJSON(ACCOUNTS_FILE) || [];

        let allVideos = [];
        for (const acct of accounts) {
            if (channelId && acct.id !== channelId) continue;
            const cached = cache[acct.id];
            if (cached && cached.videos) {
                allVideos.push(...cached.videos.map(v => ({
                    ...v,
                    channelTitle: acct.title || acct.name || acct.channelTitle,
                    channelId: acct.id,
                    channelThumbnail: acct.thumbnails?.default || acct.thumbnailUrl || '',
                })));
            }
        }

        if (search) {
            const q = search.toLowerCase();
            allVideos = allVideos.filter(v =>
                v.title?.toLowerCase().includes(q) ||
                (v.tags || []).some(t => t.toLowerCase().includes(q))
            );
        }

        if (minViews) allVideos = allVideos.filter(v => (v.viewCount || 0) >= parseInt(minViews));
        if (maxViews) allVideos = allVideos.filter(v => (v.viewCount || 0) <= parseInt(maxViews));

        const sortField = sort || 'viewCount';
        const sortOrder = order === 'asc' ? 1 : -1;
        allVideos.sort((a, b) => {
            const aVal = a[sortField] ?? 0;
            const bVal = b[sortField] ?? 0;
            if (typeof aVal === 'string') return sortOrder * aVal.localeCompare(bVal);
            return sortOrder * (bVal - aVal);
        });

        res.json({
            success: true,
            videos: allVideos,
            total: allVideos.length,
            channels: accounts.map(a => ({ id: a.id, title: a.title || a.name })),
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
