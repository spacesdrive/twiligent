// youtube reports views; reddit dropped view_count in 2018 so they are typed in
export function trackedViews(item) {
    if (!item) return 0;
    if (item.contentType === 'youtube') return item.viewCount ?? 0;
    return item.manualViews ?? 0;
}

// false for reddit posts with no views entered, so the ui can tell it from zero
export function hasTrackedViews(item) {
    if (!item) return false;
    if (item.contentType === 'youtube') return item.viewCount !== undefined && item.viewCount !== null;
    return item.manualViews !== undefined && item.manualViews !== null;
}

export function detectContentType(url) {
    const lower = (url || '').toLowerCase();
    if (lower.includes('reddit.com') || lower.includes('redd.it')) return 'reddit';
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    return null;
}

export function isRedditItem(item) {
    return (item?.contentType || 'reddit') === 'reddit';
}

// YouTube likes and Reddit karma play the same role, so lists sort and total them together
export function trackedEngagement(item) {
    return item.contentType === 'youtube' ? (item.likeCount ?? 0) : (item.score ?? 0);
}

export function trackedComments(item) {
    return item.contentType === 'youtube' ? (item.commentCount ?? 0) : (item.numComments ?? 0);
}
