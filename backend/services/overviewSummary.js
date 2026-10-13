import { getVideosCache, setVideosCache, getIGCache, setIGCache, getRedditCache, setRedditCache } from '../lib/cache.js';
import { fetchAllVideos } from './youtube.js';
import { fetchInstagramMedia, summarizeContentTypes } from './instagram.js';
import { fetchRedditProfile, fetchRedditPosts, computeRedditAnalytics } from './reddit.js';

function sumBy(items, pick) {
    return items.reduce((total, item) => total + pick(item), 0);
}

// syncing is true only when a fetch started, so the client never waits on an unfetchable account
function startWarm(context, accountId, task) {
    if (!context.redis || !task) return { id: accountId, cacheWarmed: false, syncing: false };
    // a failed warm leaves the cache empty, so the next overview load starts it again
    context.warmTasks.push(task().catch(() => undefined));
    return { id: accountId, cacheWarmed: false, syncing: true };
}

function redditWarmTask(context, account) {
    if (!account.username || !account.cookie) return null;
    return async () => {
        const [profile, posts] = await Promise.all([
            fetchRedditProfile(account.username, account.cookie),
            fetchRedditPosts(account.username, account.cookie, 100),
        ]);
        await setRedditCache(context.redis, context.userId, account.id, { profile, analytics: computeRedditAnalytics(profile, posts), posts });
    };
}

function instagramWarmTask(context, account) {
    if (!account.igUserId || !account.accessToken) return null;
    return async () => {
        const media = await fetchInstagramMedia(account.igUserId, account.accessToken, 500);
        await setIGCache(context.redis, context.userId, account.id, { media, fetchedAt: new Date().toISOString() });
    };
}

function youtubeWarmTask(context, account) {
    if (!context.apiKey || !account.uploadsPlaylistId) return null;
    return async () => {
        const videos = await fetchAllVideos(account.uploadsPlaylistId, context.apiKey, 10);
        await setVideosCache(context.redis, context.userId, account.id, { videos, fetchedAt: new Date().toISOString() });
    };
}

async function summarizeReddit(context, account) {
    const cached = await getRedditCache(context.redis, context.userId, account.id);
    if (!cached?.analytics) return startWarm(context, account.id, redditWarmTask(context, account));
    return {
        id: account.id,
        cacheWarmed: true,
        fetchedPosts: cached.analytics.fetchedPosts ?? 0,
        totalScore: cached.analytics.totalScore ?? 0,
        totalComments: cached.analytics.totalComments ?? 0,
    };
}

async function summarizeInstagram(context, account) {
    const cached = await getIGCache(context.redis, context.userId, account.id);
    if (!cached?.media) return startWarm(context, account.id, instagramWarmTask(context, account));
    const contentTypes = summarizeContentTypes(cached.media);
    const types = Object.values(contentTypes);
    return {
        id: account.id,
        cacheWarmed: true,
        totalLikes: sumBy(types, type => type.likes),
        totalComments: sumBy(types, type => type.comments),
        totalViews: sumBy(types, type => type.views),
        contentTypes,
    };
}

async function summarizeYouTube(context, account) {
    const cached = await getVideosCache(context.redis, context.userId, account.id);
    if (!cached?.videos) return startWarm(context, account.id, youtubeWarmTask(context, account));
    return {
        id: account.id,
        cacheWarmed: true,
        totalLikes: sumBy(cached.videos, video => video.likeCount ?? 0),
        totalComments: sumBy(cached.videos, video => video.commentCount ?? 0),
    };
}

async function summarizeAccount(context, account) {
    if (account.platform === 'reddit') return summarizeReddit(context, account);
    if (account.platform === 'instagram') return summarizeInstagram(context, account);
    return summarizeYouTube(context, account);
}

// an account whose cache read failed is left out instead of failing the whole overview
function collectSummaries(results) {
    const analyticsCache = {};
    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value?.id) {
            analyticsCache[result.value.id] = result.value;
        }
    });
    return analyticsCache;
}

// warmTasks are already running; the caller decides how long the runtime keeps them alive
export async function summarizeAccountCaches(accounts, { redis, userId, apiKey }) {
    const context = { redis, userId, apiKey, warmTasks: [] };
    const results = await Promise.allSettled(accounts.map(account => summarizeAccount(context, account)));
    return { analyticsCache: collectSummaries(results), warmTasks: context.warmTasks };
}
