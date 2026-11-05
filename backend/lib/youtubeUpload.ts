// the rules of a YouTube upload, pure so tests can check them and any runner can share them

// Google wants every chunk but the last to be a multiple of 256 KiB and the same size; 8 MiB is two subrequests a chunk
// (one Cloudinary range, one Google PUT), so a run on the Workers Free plan moves about 20 chunks
export const CHUNK_BYTES = 8 * 1024 * 1024;
// a failing job is tried this many times over about a day before it waits for a person
export const MAX_UPLOAD_ATTEMPTS = 8;
// a run holds a job this long; longer than one run, so a stopped run's job is free again soon after
export const UPLOAD_LEASE_SECONDS = 10 * 60;
// Google's daily allowance for the project: 100 video inserts, and 10,000 units for every other call
export const UPLOADS_PER_DAY = 100;
export const DEFAULT_UNITS_PER_DAY = 10_000;
// videos.list and thumbnails.set cost these many units of the default bucket
export const UNITS = { videosList: 1, thumbnailSet: 50 } as const;

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX_BYTES = 5000;
export const TAGS_MAX_CHARS = 500;
// YouTube counts a vertical or square video of at most three minutes as a Short
export const SHORT_MAX_SECONDS = 180;

export interface ByteRange {
    first: number;
    last: number;
}

// the next chunk to send after `confirmed` bytes of `total`; null once everything is sent
export function nextChunk(confirmed: number, total: number, chunk = CHUNK_BYTES): ByteRange | null {
    if (confirmed >= total) return null;
    return { first: confirmed, last: Math.min(confirmed + chunk, total) - 1 };
}

// Google's Range header names the last byte it holds, counted from zero: "bytes=0-524287" means 524,288 received
export function confirmedFromRange(header: string | null): number {
    const match = header?.match(/^bytes=0-(\d+)$/);
    return match ? Number(match[1]) + 1 : 0;
}

export function isShort(width: number | null, height: number | null, durationSeconds: number | null): boolean {
    if (width === null || height === null || durationSeconds === null) return false;
    return height >= width && durationSeconds <= SHORT_MAX_SECONDS;
}

export interface UploadMetadata {
    title: string;
    description: string;
    tags: string[];
}

// the first rule broken, in words a person can act on; YouTube refuses angle brackets in titles and descriptions
export function metadataProblem({ title, description, tags }: UploadMetadata): string | null {
    if (title.trim().length === 0) return 'Give the video a title.';
    if ([...title].length > TITLE_MAX) return `The title can have at most ${TITLE_MAX} characters.`;
    if (/[<>]/.test(title) || /[<>]/.test(description)) return 'YouTube does not accept < or > in a title or description.';
    if (new TextEncoder().encode(description).length > DESCRIPTION_MAX_BYTES) return `The description can be at most ${DESCRIPTION_MAX_BYTES} bytes.`;
    // YouTube counts a tag with a space as if it were quoted, two characters more
    const tagChars = tags.reduce((sum, tag) => sum + tag.length + (tag.includes(' ') ? 2 : 0), 0) + Math.max(tags.length - 1, 0);
    if (tagChars > TAGS_MAX_CHARS) return `The tags can have at most ${TAGS_MAX_CHARS} characters together.`;
    return null;
}

// exponential, from a minute to about four hours, with jitter so jobs that failed together do not retry together
export function retryDelayMs(attempts: number, random = Math.random): number {
    const base = 60_000 * 2 ** Math.min(Math.max(attempts - 1, 0), 8);
    return Math.round(base * (0.75 + random() * 0.5));
}

export type GoogleFailure = 'quota' | 'reconnect' | 'transient' | 'session_gone' | 'permanent';

// what an error answer from Google means for the job
export function classifyGoogleFailure(status: number, reason = ''): GoogleFailure {
    if (reason === 'quotaExceeded' || reason === 'uploadLimitExceeded' || reason === 'dailyLimitExceeded') return 'quota';
    if (reason === 'invalid_grant' || status === 401) return 'reconnect';
    if (status === 404 || status === 410) return 'session_gone';
    if (status === 408 || status === 429 || status >= 500) return 'transient';
    return 'permanent';
}

// YouTube's quota resets at midnight Pacific time; a job that hit it waits until just after
export function nextPacificMidnight(now: number = Date.now()): Date {
    const pacific = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        .formatToParts(now)
        .reduce<Record<string, number>>((parts, part) => (part.type === 'literal' ? parts : { ...parts, [part.type]: Number(part.value) % 24 }), {});
    const secondsIntoDay = pacific.hour * 3600 + pacific.minute * 60 + pacific.second;
    return new Date(now + (86_400 - secondsIntoDay) * 1000 + 5 * 60_000);
}
