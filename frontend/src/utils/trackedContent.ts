// the tracked video fields these helpers read
export interface TrackedMetrics {
    contentType?: string;
    viewCount?: number | null;
    likeCount?: number | null;
    commentCount?: number | null;
}

export function trackedViews(item: TrackedMetrics | null | undefined): number {
    return item?.viewCount ?? 0;
}

// false until YouTube has reported views, so the ui can tell it from zero
export function hasTrackedViews(item: TrackedMetrics | null | undefined): boolean {
    return item?.viewCount !== undefined && item?.viewCount !== null;
}

export function detectContentType(url: string | null | undefined): 'youtube' | null {
    const lower = (url || '').toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    return null;
}

export function trackedLikes(item: TrackedMetrics): number {
    return item.likeCount ?? 0;
}

export function trackedComments(item: TrackedMetrics): number {
    return item.commentCount ?? 0;
}
