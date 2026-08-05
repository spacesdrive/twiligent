// Views for a tracked item. YouTube reports a real view count; Reddit removed view_count
// from their API in 2018, so Reddit views are whatever the user entered by hand.
export function trackedViews(item) {
    if (!item) return 0;
    if (item.contentType === 'youtube') return item.viewCount ?? 0;
    return item.manualViews ?? 0;
}

// True when the item is a Reddit post whose views have not been entered yet, so the UI can
// distinguish "no views recorded" from a genuine zero
export function hasTrackedViews(item) {
    if (!item) return false;
    if (item.contentType === 'youtube') return item.viewCount !== undefined && item.viewCount !== null;
    return item.manualViews !== undefined && item.manualViews !== null;
}
