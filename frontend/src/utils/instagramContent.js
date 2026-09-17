import { fmtNum } from './formatters';

export const IG_CONTENT_TYPES = ['reel', 'post', 'video'];

export const IG_CONTENT_TYPE_META = {
    reel:  { label: 'Reel',  plural: 'Reels',  color: '#DD2A7B' },
    post:  { label: 'Post',  plural: 'Posts',  color: '#F58529' },
    video: { label: 'Video', plural: 'Videos', color: '#8134AF' },
};

export function igContentTypeMeta(type) {
    return IG_CONTENT_TYPE_META[type] ?? IG_CONTENT_TYPE_META.post;
}

// Instagram omits views when insights are unavailable, so null means "not reported", not zero
export function fmtIGViews(views) {
    return typeof views === 'number' ? fmtNum(views) : '-';
}
