// the tracked post fields these helpers read
export interface TrackedMetrics {
    contentType?: string;
    viewCount?: number | null;
    manualViews?: number | null;
    likeCount?: number | null;
    commentCount?: number | null;
    score?: number;
    numComments?: number;
}

// youtube reports views; reddit dropped view_count in 2018 so they are typed in
export function trackedViews(item: TrackedMetrics | null | undefined): number {
    if (!item) return 0;
    if (item.contentType === 'youtube') return item.viewCount ?? 0;
    return item.manualViews ?? 0;
}

// false for reddit posts with no views entered, so the ui can tell it from zero
export function hasTrackedViews(item: TrackedMetrics | null | undefined): boolean {
    if (!item) return false;
    if (item.contentType === 'youtube') return item.viewCount !== undefined && item.viewCount !== null;
    return item.manualViews !== undefined && item.manualViews !== null;
}

export function detectContentType(url: string | null | undefined): 'reddit' | 'youtube' | null {
    const lower = (url || '').toLowerCase();
    if (lower.includes('reddit.com') || lower.includes('redd.it')) return 'reddit';
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    return null;
}

export function isRedditItem(item: TrackedMetrics | null | undefined): boolean {
    return (item?.contentType || 'reddit') === 'reddit';
}

// YouTube likes and Reddit karma play the same role, so lists sort and total them together
export function trackedEngagement(item: TrackedMetrics): number {
    return item.contentType === 'youtube' ? (item.likeCount ?? 0) : (item.score ?? 0);
}

export function trackedComments(item: TrackedMetrics): number {
    return item.contentType === 'youtube' ? (item.commentCount ?? 0) : (item.numComments ?? 0);
}
