import { igFetch } from './instagramApi.js';

const MEDIA_FIELDS = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,cover_url,permalink,timestamp,like_count,comments_count';
const VIEWS_FIELD = 'insights.metric(views)';
const MEDIA_PAGE_SIZE = 50;
const MAX_MEDIA_PAGES = 10;
const REEL_PERMALINK = /instagram\.com\/reels?\//i;

// media_type never says REELS; only media_product_type tells a reel from a video
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
    const metric = raw?.insights?.data?.find(insight => insight.name === 'views');
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
        // one item without insights (e.g. pre-professional posts) fails the whole page
        return igFetch(`/${igUserId}/media`, { ...params, fields: MEDIA_FIELDS });
    }
}

function uniqueById(items) {
    const unique = new Map();
    items.forEach(item => {
        if (item?.id && !unique.has(item.id)) unique.set(item.id, item);
    });
    return [...unique.values()];
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

    return uniqueById(allMedia).slice(0, limit).map(normalizeInstagramMedia);
}
