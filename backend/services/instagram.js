// fetch is a global in Cloudflare Workers - no import needed.
import { getAccounts, updateAccount } from '../lib/db.js';

const IG_GRAPH_URL = 'https://graph.instagram.com';
const IG_API_VERSION = 'v25.0';

async function igFetch(endpoint, params = {}, retries = 1) {
    const needsVersion = !endpoint.startsWith('/oauth') &&
        !endpoint.startsWith('/access_token') &&
        !endpoint.startsWith('/refresh_access_token');
    const base = needsVersion ? `${IG_GRAPH_URL}/${IG_API_VERSION}` : IG_GRAPH_URL;
    const url = new URL(`${base}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let res;
    try {
        res = await fetch(url.toString(), { signal: controller.signal });
    } catch (err) {
        clearTimeout(timer);
        const isTransient = err.name === 'AbortError' ||
            err.message?.includes('EAI_AGAIN') ||
            err.message?.includes('ECONNRESET');
        if (isTransient && retries > 0) {
            await new Promise(r => setTimeout(r, 1000));
            return igFetch(endpoint, params, retries - 1);
        }
        if (err.name === 'AbortError') throw new Error('Instagram API request timed out');
        throw new Error(`Instagram API unreachable (${err.message})`);
    }
    clearTimeout(timer);

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || data.error.error_message || JSON.stringify(data.error));
    if (data.error_message) throw new Error(data.error_message);
    return data;
}

export async function exchangeForLongLivedToken(shortToken, appSecret) {
    const data = await igFetch('/access_token', {
        grant_type: 'ig_exchange_token',
        client_secret: appSecret,
        access_token: shortToken,
    });
    if (!data.access_token) throw new Error('Failed to exchange token - check Instagram App Secret');
    return {
        accessToken: data.access_token,
        tokenType: data.token_type || 'bearer',
        expiresIn: data.expires_in || 5184000,
    };
}

export async function refreshLongLivedToken(longToken) {
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

// Called by the daily cron trigger. Receives supabase so it works outside of
// a request context (no Hono context available in cron handlers).
export async function autoRefreshInstagramTokens(supabase) {
    try {
        const accounts = await getAccounts(supabase);
        const igAccounts = accounts.filter(a => a.platform === 'instagram' && a.accessToken && a.tokenExpiresAt);
        if (igAccounts.length === 0) return;

        const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
        const soon = new Date(Date.now() + fifteenDaysMs);
        const toRefresh = igAccounts.filter(a => new Date(a.tokenExpiresAt) <= soon);
        if (toRefresh.length === 0) return;

        for (const account of toRefresh) {
            try {
                const refreshed = await refreshLongLivedToken(account.accessToken);
                const tokenExpiresAt = new Date(Date.now() + (refreshed.expiresIn || 5184000) * 1000).toISOString();
                await updateAccount(supabase, account.id, { accessToken: refreshed.accessToken, tokenExpiresAt });
                console.log(`Token refreshed for @${account.username} - expires ${tokenExpiresAt}`);
            } catch (err) {
                console.error(`Failed to refresh token for @${account.username}: ${err.message}`);
            }
        }
    } catch (err) {
        console.error('autoRefreshInstagramTokens error:', err.message);
    }
}

export async function fetchInstagramProfile(igUserId, accessToken) {
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

export const CONTENT_TYPES = ['reel', 'post', 'video'];

const MEDIA_FIELDS = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,cover_url,permalink,timestamp,like_count,comments_count';
const VIEWS_FIELD = 'insights.metric(views)';
const MEDIA_PAGE_SIZE = 50;
const MAX_MEDIA_PAGES = 10;
const REEL_PERMALINK = /instagram\.com\/reels?\//i;

// media_type never says REELS - Instagram reports reels as VIDEO and only media_product_type tells them apart.
export function classifyInstagramMedia(raw) {
    const productType = String(raw?.media_product_type || '').toUpperCase();
    const mediaType = String(raw?.media_type || '').toUpperCase();

    if (productType === 'REELS') return 'reel';
    if (!productType && REEL_PERMALINK.test(raw?.permalink || '')) return 'reel';
    if (mediaType === 'REELS' || mediaType === 'REEL') return 'reel';
    if (mediaType === 'VIDEO') return 'video';
    return 'post';
}

export function extractInstagramViews(raw) {
    const metric = raw?.insights?.data?.find(d => d.name === 'views');
    const value = metric?.values?.[0]?.value ?? metric?.total_value?.value;
    const views = Number(value);
    return value !== undefined && value !== null && Number.isFinite(views) ? views : null;
}

export function normalizeInstagramMedia(raw) {
    const contentType = classifyInstagramMedia(raw);
    const mediaType = String(raw.media_type || 'IMAGE').toUpperCase();
    return {
        id: raw.id,
        caption: raw.caption || '',
        contentType,
        mediaType,
        mediaUrl: raw.media_url || '',
        thumbnailUrl: raw.cover_url || raw.thumbnail_url || (contentType === 'post' ? raw.media_url || '' : ''),
        permalink: raw.permalink || '',
        timestamp: raw.timestamp || '',
        likeCount: raw.like_count || 0,
        commentsCount: raw.comments_count || 0,
        viewCount: extractInstagramViews(raw),
    };
}

async function fetchMediaPage(igUserId, accessToken, after) {
    const params = { access_token: accessToken, limit: String(MEDIA_PAGE_SIZE) };
    if (after) params.after = after;
    try {
        return await igFetch(`/${igUserId}/media`, { ...params, fields: `${MEDIA_FIELDS},${VIEWS_FIELD}` });
    } catch {
        // One item without insights (e.g. posted before the account went professional) fails the whole page.
        return igFetch(`/${igUserId}/media`, { ...params, fields: MEDIA_FIELDS });
    }
}

export async function fetchInstagramMedia(igUserId, accessToken, limit = 500) {
    const allMedia = [];
    let after = null;

    for (let page = 0; page < MAX_MEDIA_PAGES && allMedia.length < limit; page++) {
        const data = await fetchMediaPage(igUserId, accessToken, after);
        if (Array.isArray(data.data)) allMedia.push(...data.data);
        after = data.paging?.next ? data.paging?.cursors?.after : null;
        if (!after) break;
    }

    const unique = new Map();
    allMedia.forEach(m => { if (m?.id && !unique.has(m.id)) unique.set(m.id, m); });
    return [...unique.values()].slice(0, limit).map(normalizeInstagramMedia);
}

export function summarizeContentTypes(media) {
    const summary = {};
    CONTENT_TYPES.forEach(type => {
        summary[type] = { count: 0, likes: 0, comments: 0, views: 0, viewsReported: 0 };
    });
    (media || []).forEach(m => {
        const s = summary[CONTENT_TYPES.includes(m.contentType) ? m.contentType : 'post'];
        s.count++;
        s.likes += m.likeCount || 0;
        s.comments += m.commentsCount || 0;
        if (typeof m.viewCount === 'number') {
            s.views += m.viewCount;
            s.viewsReported++;
        }
    });
    return summary;
}

function buildContentTypeStats(media) {
    const summary = summarizeContentTypes(media);
    const stats = {};
    CONTENT_TYPES.forEach(type => {
        const s = summary[type];
        stats[type] = {
            count: s.count,
            totalLikes: s.likes,
            totalComments: s.comments,
            totalViews: s.views,
            viewsReported: s.viewsReported,
            avgLikes: s.count > 0 ? Math.round(s.likes / s.count) : 0,
            avgComments: s.count > 0 ? Math.round(s.comments / s.count) : 0,
            avgEngagement: s.count > 0 ? Math.round((s.likes + s.comments) / s.count) : 0,
            avgViews: s.viewsReported > 0 ? Math.round(s.views / s.viewsReported) : 0,
        };
    });
    return stats;
}

export function computeInstagramAnalytics(profile, media) {
    const emptyAnalytics = {
        totalPosts: profile.mediaCount || 0, fetchedPosts: 0,
        totalLikes: 0, totalComments: 0, totalEngagement: 0,
        avgLikes: 0, avgComments: 0, avgEngagement: 0,
        medianLikes: 0, medianComments: 0,
        engagementRate: 0, likesPerFollower: 0, commentsPerFollower: 0,
        totalViews: 0, avgViews: 0, mediaWithViews: 0,
        bestByLikes: null, bestByComments: null, worstByLikes: null,
        recentMedia: [], contentTypeStats: buildContentTypeStats([]),
        postFrequency: { perWeek: 0, perMonth: 0 },
        topPosts: [],
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

    const contentTypeStats = buildContentTypeStats(media);
    const mediaWithViews = CONTENT_TYPES.reduce((s, t) => s + contentTypeStats[t].viewsReported, 0);
    const totalViews = CONTENT_TYPES.reduce((s, t) => s + contentTypeStats[t].totalViews, 0);
    const avgViews = mediaWithViews > 0 ? Math.round(totalViews / mediaWithViews) : 0;

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

    const now = Date.now();
    const postsLast7Days = dates.filter(d => (now - d.getTime()) <= 7 * 86400000).length;
    const postsLast30Days = dates.filter(d => (now - d.getTime()) <= 30 * 86400000).length;
    const postsLast90Days = dates.filter(d => (now - d.getTime()) <= 90 * 86400000).length;

    const hashtagMap = {};
    media.forEach(m => {
        const tags = (m.caption || '').match(/#[\wÀ-ɏ]+/g) || [];
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
        totalViews, avgViews, mediaWithViews,
        bestByLikes: byLikes[0] || null,
        bestByComments: byComments[0] || null,
        worstByLikes,
        recentMedia: media.slice(0, 20),
        contentTypeStats,
        postFrequency: { perWeek, perMonth },
        topPosts,
        postsByDayOfWeek, bestPostingDay: bestDayObj?.day || '',
        postsByHour, bestPostingHour: bestHourObj?.posts > 0 ? bestHourObj.label : '',
        engagementTimeline: monthlyBreakdown, monthlyBreakdown,
        postsLast7Days, postsLast30Days, postsLast90Days,
        hashtagAnalysis,
        captionLengthCorrelation,
        viralityScore, consistencyScore,
    };
}
