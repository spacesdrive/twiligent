export type TrackedContentType = 'youtube';

export const UNSUPPORTED_LINK_MESSAGE = 'Only YouTube video links can be tracked. Paste a youtube.com or youtu.be link.';

export function detectContentType(url: string | null | undefined): TrackedContentType | null {
    const lower = (url || '').toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    return null;
}
