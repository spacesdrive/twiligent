export type TrackedContentType = 'reddit' | 'youtube';

// either a validation error to send back or the fields to merge into the tracked post's data
export type PatchResult<P> = { error: string; patch?: undefined } | { patch: P; error?: undefined };

export function detectContentType(url: string | null | undefined): TrackedContentType | null {
    const lower = (url || '').toLowerCase();
    if (lower.includes('reddit.com') || lower.includes('redd.it')) return 'reddit';
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    return null;
}

// reddit dropped view_count in 2018 so views are typed in; youtube keeps its own
export function manualViewsPatch(manualViews: unknown, isYouTube: boolean): PatchResult<{ manualViews: number | null }> {
    if (isYouTube) return { error: 'YouTube view counts are fetched automatically and cannot be set by hand' };
    if (manualViews === null || manualViews === '') return { patch: { manualViews: null } };

    const views = Number(manualViews);
    if (!Number.isInteger(views) || views < 0) return { error: 'Views must be a whole number of 0 or more' };
    return { patch: { manualViews: views } };
}

function parseUrl(value: unknown): URL | null {
    try {
        return new URL(String(value));
    } catch {
        // anything the URL parser rejects is not a usable image address
        return null;
    }
}

// reddit has no thumbnail, so the browser uploads one; youtube keeps its own
export function imageUrlPatch(imageUrl: unknown, isYouTube: boolean): PatchResult<{ imageUrl: string | null }> {
    if (isYouTube) return { error: 'Images can only be attached to Reddit posts' };
    if (imageUrl === null || imageUrl === '') return { patch: { imageUrl: null } };

    const parsed = parseUrl(imageUrl);
    // https only: it lands in an img src, so javascript: and data: urls are refused
    if (!parsed || parsed.protocol !== 'https:') return { error: 'Image must be an https URL returned by the uploader' };
    return { patch: { imageUrl: parsed.toString() } };
}
