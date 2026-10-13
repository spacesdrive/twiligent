import { fmtNum } from './formatters.js';

export const IG_CONTENT_TYPES = ['reel', 'post', 'video'];

// Colours are brand chart series so they follow the theme
export const IG_CONTENT_TYPE_META = {
    reel:  { label: 'Reel',  plural: 'Reels',  color: 'var(--chart-1)' },
    post:  { label: 'Post',  plural: 'Posts',  color: 'var(--chart-3)' },
    video: { label: 'Video', plural: 'Videos', color: 'var(--chart-4)' },
};

export function igContentTypeMeta(type) {
    return IG_CONTENT_TYPE_META[type] ?? IG_CONTENT_TYPE_META.post;
}

// Instagram omits views when insights are unavailable, so null means "not reported", not zero
export function fmtIGViews(views) {
    return typeof views === 'number' ? fmtNum(views) : '-';
}

// image posts can lack a thumbnail url, so they fall back to the image itself
export function igThumbnail(item) {
    if (item.contentType === 'post') return item.thumbnailUrl || item.mediaUrl;
    return item.thumbnailUrl;
}
