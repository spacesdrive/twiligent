export function detectContentType(url) {
    const lower = (url || '').toLowerCase();
    if (lower.includes('reddit.com') || lower.includes('redd.it')) return 'reddit';
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    return null;
}

// reddit dropped view_count in 2018 so views are typed in; a youtube count is never overridden
export function manualViewsPatch(manualViews, isYouTube) {
    if (isYouTube) return { error: 'YouTube view counts are fetched automatically and cannot be set by hand' };
    if (manualViews === null || manualViews === '') return { patch: { manualViews: null } };

    const views = Number(manualViews);
    if (!Number.isInteger(views) || views < 0) return { error: 'Views must be a whole number of 0 or more' };
    return { patch: { manualViews: views } };
}

function parseUrl(value) {
    try {
        return new URL(String(value));
    } catch {
        // anything the URL parser rejects is not a usable image address
        return null;
    }
}

// reddit json has no thumbnail, so the browser uploads one; youtube thumbnails stay untouched
export function imageUrlPatch(imageUrl, isYouTube) {
    if (isYouTube) return { error: 'Images can only be attached to Reddit posts' };
    if (imageUrl === null || imageUrl === '') return { patch: { imageUrl: null } };

    const parsed = parseUrl(imageUrl);
    // https only: the value goes straight into an img src, so javascript: and data: urls are refused
    if (!parsed || parsed.protocol !== 'https:') return { error: 'Image must be an https URL returned by the uploader' };
    return { patch: { imageUrl: parsed.toString() } };
}
