import { fmtNum } from './formatters.ts';
import type { InstagramContentType, InstagramMedia } from '../../../shared/types/instagram.ts';

export interface IGContentTypeMeta {
    label: string;
    plural: string;
    color: string;
}

export const IG_CONTENT_TYPES: InstagramContentType[] = ['reel', 'post', 'video'];

// chart series that follow the theme; the YouTube (chart-1) and Reddit (chart-4) hues are left out so a colour
// never names two platforms
export const IG_CONTENT_TYPE_META: Record<InstagramContentType, IGContentTypeMeta> = {
    reel:  { label: 'Reel',  plural: 'Reels',  color: 'var(--chart-5)' },
    post:  { label: 'Post',  plural: 'Posts',  color: 'var(--chart-3)' },
    video: { label: 'Video', plural: 'Videos', color: 'var(--chart-2)' },
};

export function igContentTypeMeta(type: string | null | undefined): IGContentTypeMeta {
    return IG_CONTENT_TYPE_META[type as InstagramContentType] ?? IG_CONTENT_TYPE_META.post;
}

// Instagram omits views when insights are unavailable, so null means "not reported", not zero
export function fmtIGViews(views: number | null | undefined): string {
    return typeof views === 'number' ? fmtNum(views) : '-';
}

// image posts can lack a thumbnail url, so they fall back to the image itself
export function igThumbnail(item: Pick<InstagramMedia, 'contentType'> & Partial<Pick<InstagramMedia, 'thumbnailUrl' | 'mediaUrl'>>): string | undefined {
    if (item.contentType === 'post') return item.thumbnailUrl || item.mediaUrl;
    return item.thumbnailUrl;
}
