const fetch = require('node-fetch');
const { readJSON, writeJSON, ACCOUNTS_FILE } = require('../utils/dataHelpers');

const IG_GRAPH_URL = 'https://graph.instagram.com';
const IG_API_VERSION = 'v25.0';

async function igFetch(endpoint, params = {}) {
    const needsVersion = !endpoint.startsWith('/oauth') &&
        !endpoint.startsWith('/access_token') &&
        !endpoint.startsWith('/refresh_access_token');
    const base = needsVersion ? `${IG_GRAPH_URL}/${IG_API_VERSION}` : IG_GRAPH_URL;
    const url = new URL(`${base}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || data.error.error_message || JSON.stringify(data.error));
    if (data.error_message) throw new Error(data.error_message);
    return data;
}

async function exchangeForLongLivedToken(shortToken, appSecret) {
    const data = await igFetch('/access_token', {
        grant_type: 'ig_exchange_token',
        client_secret: appSecret,
        access_token: shortToken,
    });
    if (!data.access_token) throw new Error('Failed to exchange token — check Instagram App Secret');
    return {
        accessToken: data.access_token,
        tokenType: data.token_type || 'bearer',
        expiresIn: data.expires_in || 5184000,
    };
}

async function refreshLongLivedToken(longToken) {
    const data = await igFetch('/refresh_access_token', {
        grant_type: 'ig_refresh_token',
        access_token: longToken,
    });
    if (!data.access_token) throw new Error('Failed to refresh token');
    return {
        accessToken: data.access_token,
        tokenType: data.token_type || 'bearer',
        expiresIn: data.expires_in || 5184000,
    };
}

// Auto-refresh tokens expiring within 15 days. Called on startup and every 24h.
async function autoRefreshInstagramTokens() {
    try {
        const accounts = await readJSON(ACCOUNTS_FILE) || [];
        const igAccounts = accounts.filter(a => a.platform === 'instagram' && a.accessToken && a.tokenExpiresAt);
        if (igAccounts.length === 0) return;

        const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
        const soon = new Date(Date.now() + fifteenDaysMs);
        const toRefresh = igAccounts.filter(a => new Date(a.tokenExpiresAt) <= soon);
        if (toRefresh.length === 0) return;

        console.log(`\n  🔑 Auto-refreshing ${toRefresh.length} Instagram token(s) expiring within 15 days...`);
        let changed = false;
        for (const account of toRefresh) {
            try {
                const refreshed = await refreshLongLivedToken(account.accessToken);
                account.accessToken = refreshed.accessToken;
                account.tokenExpiresAt = new Date(Date.now() + (refreshed.expiresIn || 5184000) * 1000).toISOString();
                console.log(`  ✅ Token refreshed for @${account.username} — expires ${account.tokenExpiresAt}`);
                changed = true;
            } catch (err) {
                console.error(`  ❌ Failed to refresh token for @${account.username}: ${err.message}`);
            }
        }

        if (changed) {
            await writeJSON(ACCOUNTS_FILE, accounts);
            // Lazy-require to avoid circular dependency at module load time
            const { syncEverythingToGitHub } = require('./github');
            syncEverythingToGitHub().catch(() => { });
        }
    } catch (err) {
        console.error('  ❌ autoRefreshInstagramTokens error:', err.message);
    }
}

async function fetchInstagramProfile(igUserId, accessToken) {
    const endpoint = igUserId ? `/${igUserId}` : '/me';
    const data = await igFetch(endpoint, {
        access_token: accessToken,
        fields: 'user_id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website',
    });
    return {
        igUserId: data.user_id || data.id || igUserId,
        name: data.name || '',
        username: data.username || '',
        profilePictureUrl: data.profile_picture_url || '',
        followersCount: data.followers_count || 0,
        followsCount: data.follows_count || 0,
        mediaCount: data.media_count || 0,
        biography: data.biography || '',
        website: data.website || '',
    };
}

async function fetchInstagramMedia(igUserId, accessToken, limit = 500) {
    let allMedia = [];
    let url = `${IG_GRAPH_URL}/${IG_API_VERSION}/${igUserId}/media?access_token=${accessToken}&fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=${Math.min(limit, 100)}`;

    let pages = 0;
    while (url && pages < 10 && allMedia.length < limit) {
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || data.error.error_message);
        if (data.data) allMedia = allMedia.concat(data.data);
        url = data.paging?.next || null;
        pages++;
    }

    return allMedia.slice(0, limit).map(m => ({
        id: m.id,
        caption: m.caption || '',
        mediaType: m.media_type || 'IMAGE',
        mediaUrl: m.media_url || '',
        thumbnailUrl: m.thumbnail_url || m.media_url || '',
        permalink: m.permalink || '',
        timestamp: m.timestamp || '',
        likeCount: m.like_count || 0,
        commentsCount: m.comments_count || 0,
    }));
}

function computeInstagramAnalytics(profile, media) {
    const emptyAnalytics = {
        totalPosts: profile.mediaCount || 0, fetchedPosts: 0,
        totalLikes: 0, totalComments: 0, totalEngagement: 0,
        avgLikes: 0, avgComments: 0, avgEngagement: 0,
        medianLikes: 0, medianComments: 0,
        engagementRate: 0, likesPerFollower: 0, commentsPerFollower: 0,
        bestByLikes: null, bestByComments: null, worstByLikes: null,
        recentMedia: [], mediaTypeDistribution: {},
        postFrequency: { perWeek: 0, perMonth: 0 },
        topPosts: [], performanceByType: {},
        hashtagAnalysis: [], captionLengthCorrelation: [],
        postsByDayOfWeek: [], postsByHour: [],
        engagementTimeline: [], monthlyBreakdown: [],
        postsLast7Days: 0, postsLast30Days: 0, postsLast90Days: 0,
        viralityScore: 0, consistencyScore: 0,
        bestPostingDay: '', bestPostingHour: '',
        likesToCommentsRatio: 0,
    };
    if (!media || media.length === 0) return emptyAnalytics;

    const totalLikes = media.reduce((s, m) => s + m.likeCount, 0);
    const totalComments = media.reduce((s, m) => s + m.commentsCount, 0);
    const totalEngagement = totalLikes + totalComments;
    const avgLikes = Math.round(totalLikes / media.length);
    const avgComments = Math.round(totalComments / media.length);
    const avgEngagement = Math.round(totalEngagement / media.length);
    const engagementRate = profile.followersCount > 0
        ? parseFloat(((totalLikes + totalComments) / media.length / profile.followersCount * 100).toFixed(2)) : 0;
    const likesPerFollower = profile.followersCount > 0
        ? parseFloat((totalLikes / media.length / profile.followersCount * 100).toFixed(2)) : 0;
    const commentsPerFollower = profile.followersCount > 0
        ? parseFloat((totalComments / media.length / profile.followersCount * 100).toFixed(2)) : 0;

    const sortedLikes = [...media].map(m => m.likeCount).sort((a, b) => a - b);
    const sortedComments = [...media].map(m => m.commentsCount).sort((a, b) => a - b);
    const mid = Math.floor(sortedLikes.length / 2);
    const medianLikes = sortedLikes.length % 2 ? sortedLikes[mid] : Math.round((sortedLikes[mid - 1] + sortedLikes[mid]) / 2);
    const medianComments = sortedComments.length % 2 ? sortedComments[mid] : Math.round((sortedComments[mid - 1] + sortedComments[mid]) / 2);

    const byLikes = [...media].sort((a, b) => b.likeCount - a.likeCount);
    const byComments = [...media].sort((a, b) => b.commentsCount - a.commentsCount);
    const likesToCommentsRatio = totalComments > 0 ? parseFloat((totalLikes / totalComments).toFixed(1)) : 0;

    const mediaTypes = {};
    const typeStats = {};
    media.forEach(m => {
        const t = m.mediaType;
        mediaTypes[t] = (mediaTypes[t] || 0) + 1;
        if (!typeStats[t]) typeStats[t] = { likes: 0, comments: 0, count: 0 };
        typeStats[t].likes += m.likeCount;
        typeStats[t].comments += m.commentsCount;
        typeStats[t].count++;
    });
    const performanceByType = {};
    Object.entries(typeStats).forEach(([type, s]) => {
        performanceByType[type] = {
            count: s.count,
            avgLikes: Math.round(s.likes / s.count),
            avgComments: Math.round(s.comments / s.count),
            avgEngagement: Math.round((s.likes + s.comments) / s.count),
            totalLikes: s.likes,
            totalComments: s.comments,
        };
    });

    const dates = media.map(m => new Date(m.timestamp)).filter(d => !isNaN(d));
    let perWeek = 0, perMonth = 0;
    if (dates.length >= 2) {
        const newest = Math.max(...dates);
        const oldest = Math.min(...dates);
        const spanDays = Math.max(1, (newest - oldest) / 86400000);
        perWeek = parseFloat((media.length / spanDays * 7).toFixed(1));
        perMonth = parseFloat((media.length / spanDays * 30).toFixed(1));
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayBuckets = Array(7).fill(null).map(() => ({ count: 0, likes: 0, comments: 0 }));
    dates.forEach((d, i) => {
        const day = d.getDay();
        dayBuckets[day].count++;
        dayBuckets[day].likes += media[i]?.likeCount || 0;
        dayBuckets[day].comments += media[i]?.commentsCount || 0;
    });
    const postsByDayOfWeek = dayBuckets.map((b, i) => ({
        day: dayNames[i], shortDay: dayNames[i].slice(0, 3),
        posts: b.count,
        avgLikes: b.count > 0 ? Math.round(b.likes / b.count) : 0,
        avgComments: b.count > 0 ? Math.round(b.comments / b.count) : 0,
        avgEngagement: b.count > 0 ? Math.round((b.likes + b.comments) / b.count) : 0,
    }));
    const bestDayObj = postsByDayOfWeek.reduce((best, d) => d.avgEngagement > best.avgEngagement ? d : best, postsByDayOfWeek[0]);
    const bestPostingDay = bestDayObj?.day || '';

    const hourBuckets = Array(24).fill(null).map(() => ({ count: 0, likes: 0, comments: 0 }));
    dates.forEach((d, i) => {
        const h = d.getHours();
        hourBuckets[h].count++;
        hourBuckets[h].likes += media[i]?.likeCount || 0;
        hourBuckets[h].comments += media[i]?.commentsCount || 0;
    });
    const postsByHour = hourBuckets.map((b, i) => ({
        hour: i, label: `${i}:00`,
        posts: b.count,
        avgEngagement: b.count > 0 ? Math.round((b.likes + b.comments) / b.count) : 0,
    }));
    const bestHourObj = postsByHour.reduce((best, h) => h.avgEngagement > best.avgEngagement ? h : best, postsByHour[0]);
    const bestPostingHour = bestHourObj?.posts > 0 ? bestHourObj.label : '';

    const monthMap = {};
    media.forEach(m => {
        const d = new Date(m.timestamp);
        if (isNaN(d)) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap[key]) monthMap[key] = { posts: 0, likes: 0, comments: 0 };
        monthMap[key].posts++;
        monthMap[key].likes += m.likeCount;
        monthMap[key].comments += m.commentsCount;
    });
    const monthlyBreakdown = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, s]) => ({
            month, posts: s.posts,
            likes: s.likes, comments: s.comments,
            avgLikes: Math.round(s.likes / s.posts),
            avgComments: Math.round(s.comments / s.posts),
            engagement: s.likes + s.comments,
        }));
    const engagementTimeline = monthlyBreakdown;

    const now = Date.now();
    const postsLast7Days = dates.filter(d => (now - d.getTime()) <= 7 * 86400000).length;
    const postsLast30Days = dates.filter(d => (now - d.getTime()) <= 30 * 86400000).length;
    const postsLast90Days = dates.filter(d => (now - d.getTime()) <= 90 * 86400000).length;

    const hashtagMap = {};
    media.forEach(m => {
        const tags = (m.caption || '').match(/#[\w\u00C0-\u024F]+/g) || [];
        tags.forEach(tag => {
            const t = tag.toLowerCase();
            if (!hashtagMap[t]) hashtagMap[t] = { tag: t, count: 0, likes: 0, comments: 0 };
            hashtagMap[t].count++;
            hashtagMap[t].likes += m.likeCount;
            hashtagMap[t].comments += m.commentsCount;
        });
    });
    const hashtagAnalysis = Object.values(hashtagMap)
        .map(h => ({ ...h, avgEngagement: Math.round((h.likes + h.comments) / h.count) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

    const captionBuckets = [
        { label: 'No caption', min: 0, max: 0 },
        { label: 'Short (1-50)', min: 1, max: 50 },
        { label: 'Medium (51-150)', min: 51, max: 150 },
        { label: 'Long (151-300)', min: 151, max: 300 },
        { label: 'Very Long (300+)', min: 301, max: Infinity },
    ];
    const captionLengthCorrelation = captionBuckets.map(bucket => {
        const posts = media.filter(m => {
            const len = (m.caption || '').length;
            return len >= bucket.min && len <= bucket.max;
        });
        return {
            label: bucket.label, count: posts.length,
            avgLikes: posts.length > 0 ? Math.round(posts.reduce((s, m) => s + m.likeCount, 0) / posts.length) : 0,
            avgComments: posts.length > 0 ? Math.round(posts.reduce((s, m) => s + m.commentsCount, 0) / posts.length) : 0,
            avgEngagement: posts.length > 0 ? Math.round(posts.reduce((s, m) => s + m.likeCount + m.commentsCount, 0) / posts.length) : 0,
        };
    }).filter(b => b.count > 0);

    const topPosts = [...media]
        .map(m => ({ ...m, engagement: m.likeCount + m.commentsCount }))
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 10);
    const worstByLikes = byLikes.length > 0 ? byLikes[byLikes.length - 1] : null;

    const bestEngagement = topPosts[0] ? topPosts[0].engagement : 0;
    const viralityScore = avgEngagement > 0 ? parseFloat((bestEngagement / avgEngagement).toFixed(1)) : 0;

    let consistencyScore = 0;
    if (media.length >= 3) {
        const engagements = media.map(m => m.likeCount + m.commentsCount);
        const mean = engagements.reduce((s, v) => s + v, 0) / engagements.length;
        const variance = engagements.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / engagements.length;
        const stdDev = Math.sqrt(variance);
        // Social media engagement is inherently high-variance (viral posts skew cv >> 1).
        // Use 100/(1+cv) so cv=0→100, cv=1→50, cv=2→33 — avoids always-zero for normal accounts.
        const cv = mean > 0 ? stdDev / mean : (stdDev > 0 ? 10 : 0);
        consistencyScore = Math.max(0, Math.min(100, Math.round(100 / (1 + cv))));
    }

    return {
        totalPosts: profile.mediaCount || media.length,
        fetchedPosts: media.length,
        totalLikes, totalComments, totalEngagement,
        avgLikes, avgComments, avgEngagement,
        medianLikes, medianComments,
        engagementRate, likesPerFollower, commentsPerFollower,
        likesToCommentsRatio,
        bestByLikes: byLikes[0] || null,
        bestByComments: byComments[0] || null,
        worstByLikes,
        recentMedia: media.slice(0, 20),
        mediaTypeDistribution: mediaTypes,
        performanceByType,
        postFrequency: { perWeek, perMonth },
        topPosts,
        postsByDayOfWeek, bestPostingDay,
        postsByHour, bestPostingHour,
        engagementTimeline, monthlyBreakdown,
        postsLast7Days, postsLast30Days, postsLast90Days,
        hashtagAnalysis,
        captionLengthCorrelation,
        viralityScore, consistencyScore,
    };
}

module.exports = {
    igFetch,
    exchangeForLongLivedToken,
    refreshLongLivedToken,
    autoRefreshInstagramTokens,
    fetchInstagramProfile,
    fetchInstagramMedia,
    computeInstagramAnalytics,
};
