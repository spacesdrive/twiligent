import { igFetch } from './instagramApi.ts';
import type { GraphParams } from './instagramApi.ts';
import type { InstagramContentType, InstagramMedia } from '../../../shared/types/instagram.ts';

const MEDIA_FIELDS = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,cover_url,permalink,timestamp,like_count,comments_count';
const VIEWS_FIELD = 'insights.metric(views)';
const MEDIA_PAGE_SIZE = 50;
const MAX_MEDIA_PAGES = 10;
const REEL_PERMALINK = /instagram\.com\/reels?\//i;

export interface InstagramApiInsight {
    name: string;
    values?: { value?: number }[];
    total_value?: { value?: number };
}

// one item of the /{ig-user-id}/media edge with MEDIA_FIELDS and, when allowed, the views insight
export interface InstagramApiMedia {
    id: string;
    caption?: string;
    media_type?: string;
    media_product_type?: string;
    media_url?: string;
    thumbnail_url?: string;
    cover_url?: string;
    permalink?: string;
    timestamp?: string;
    like_count?: number;
    comments_count?: number;
    insights?: { data?: InstagramApiInsight[] };
}

interface InstagramApiMediaPage {
    data?: InstagramApiMedia[];
    paging?: {
        next?: string;
        cursors?: { before?: string; after?: string };
    };
}

// media_type never says REELS; only media_product_type tells a reel from a video
export function classifyInstagramMedia(raw: Partial<InstagramApiMedia> | null | undefined): InstagramContentType {
    const productType = String(raw?.media_product_type || '').toUpperCase();
    const mediaType = String(raw?.media_type || '').toUpperCase();

    if (productType === 'REELS') return 'reel';
    if (!productType && REEL_PERMALINK.test(raw?.permalink || '')) return 'reel';
    if (mediaType === 'REELS' || mediaType === 'REEL') return 'reel';
    if (mediaType === 'VIDEO') return 'video';
    return 'post';
}

export function extractInstagramViews(raw: Partial<InstagramApiMedia> | null | undefined): number | null {
    const metric = raw?.insights?.data?.find(insight => insight.name === 'views');
    const value = metric?.values?.[0]?.value ?? metric?.total_value?.value;
    const views = Number(value);
    return value !== undefined && value !== null && Number.isFinite(views) ? views : null;
}

export function normalizeInstagramMedia(raw: InstagramApiMedia): InstagramMedia {
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

async function fetchMediaPage(igUserId: string, accessToken: string, after: string | null | undefined): Promise<InstagramApiMediaPage> {
    const params: GraphParams = { access_token: accessToken, limit: String(MEDIA_PAGE_SIZE) };
    if (after) params.after = after;
    try {
        return await igFetch<InstagramApiMediaPage>(`/${igUserId}/media`, { ...params, fields: `${MEDIA_FIELDS},${VIEWS_FIELD}` });
    } catch {
        // one item without insights (e.g. pre-professional posts) fails the whole page
        return igFetch<InstagramApiMediaPage>(`/${igUserId}/media`, { ...params, fields: MEDIA_FIELDS });
    }
}

function uniqueById(items: InstagramApiMedia[]): InstagramApiMedia[] {
    const unique = new Map<string, InstagramApiMedia>();
    items.forEach(item => {
        if (item?.id && !unique.has(item.id)) unique.set(item.id, item);
    });
    return [...unique.values()];
}

export async function fetchInstagramMedia(igUserId: string, accessToken: string, limit = 500): Promise<InstagramMedia[]> {
    const allMedia: InstagramApiMedia[] = [];
    let after: string | null | undefined = null;

    for (let page = 0; page < MAX_MEDIA_PAGES && allMedia.length < limit; page++) {
        const data = await fetchMediaPage(igUserId, accessToken, after);
        if (Array.isArray(data.data)) allMedia.push(...data.data);
        after = data.paging?.next ? data.paging?.cursors?.after : null;
        if (!after) break;
    }

    return uniqueById(allMedia).slice(0, limit).map(normalizeInstagramMedia);
}
