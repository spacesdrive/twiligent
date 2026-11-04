import type { SafeAccount } from '../../../shared/types/domain.ts';

export type NumberLike = number | string | null | undefined;
export type DateLike = string | number | Date | null | undefined;

const COMPACT_UNITS: ReadonlyArray<readonly [number, string]> = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']];

// one decimal, without a trailing .0, and a value that would round up to 1000 of a unit moves to the next unit
export function fmtNum(n: NumberLike): string {
    if (n == null) return '0';
    const value = Number(n);
    const size = Math.abs(value);
    for (let index = 0; index < COMPACT_UNITS.length; index++) {
        const [unit, suffix] = COMPACT_UNITS[index];
        const smaller = COMPACT_UNITS[index + 1];
        const roundsUp = smaller !== undefined && Math.round((size / smaller[0]) * 10) / 10 >= 1000;
        if (size >= unit || roundsUp) return String(Number((value / unit).toFixed(1))) + suffix;
    }
    return value.toLocaleString('en-US');
}

// For counts a platform can hide (YouTube likes, disabled comments): null means hidden, not zero.
export function fmtCount(n: NumberLike): string {
    return n == null ? 'Hidden' : fmtNum(n);
}

export function fmtNumFull(n: NumberLike): string {
    if (n == null) return '0';
    return Number(n).toLocaleString('en-US');
}

export function fmtDate(d: DateLike): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtDateTime(d: DateLike): string {
    if (!d) return '';
    return new Date(d).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
}

export function fmtDateShort(d: DateLike): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fmtDuration(seconds: number | null | undefined): string {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function fmtPercent(n: NumberLike): string {
    if (n == null) return '0%';
    return Number(n).toFixed(1) + '%';
}

export function timeAgo(date: DateLike): string {
    if (!date) return 'Never';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    // past a month a relative age is harder to place than the date itself
    return fmtDate(date);
}

export const CATEGORY_MAP: Record<string, string> = {
    '1': 'Film & Animation', '2': 'Autos & Vehicles', '10': 'Music',
    '15': 'Pets & Animals', '17': 'Sports', '18': 'Short Movies',
    '19': 'Travel & Events', '20': 'Gaming', '21': 'Videoblogging',
    '22': 'People & Blogs', '23': 'Comedy', '24': 'Entertainment',
    '25': 'News & Politics', '26': 'Howto & Style', '27': 'Education',
    '28': 'Science & Technology', '29': 'Nonprofits & Activism',
    '30': 'Movies', '31': 'Anime/Animation', '32': 'Action/Adventure',
    '33': 'Classics', '34': 'Comedy', '35': 'Documentary',
    '36': 'Drama', '37': 'Family', '38': 'Foreign',
    '39': 'Horror', '40': 'Sci-Fi/Fantasy', '41': 'Thriller',
    '42': 'Shorts', '43': 'Shows', '44': 'Trailers',
};

// fields that accounts saved by older versions can still carry
export interface LegacyAccountFields {
    name?: string;
    channelTitle?: string;
    thumbnailUrl?: string;
    thumbnail?: string;
    currentStats?: { subscribers?: number; views?: number; videos?: number };
}

export type AccountInput = SafeAccount & LegacyAccountFields;

// an account as AppContext keeps it; instagram titles fall back to igUserId, which can be null
export type AppAccount = Omit<AccountInput, 'title' | 'thumbnail'> & {
    title?: string | null;
    thumbnail: string;
};

// Normalize account data (handles YouTube and Instagram)
export function normalizeAccount(acct: AccountInput): AppAccount {
    if (!acct) return acct;
    if (acct.platform === 'instagram') {
        return {
            ...acct,
            title: acct.title || acct.name || acct.username || acct.igUserId,
            thumbnail: acct.profilePictureUrl || '',
            followersCount: acct.followersCount || 0,
            followsCount: acct.followsCount || 0,
            mediaCount: acct.mediaCount || 0,
        };
    }
    return {
        ...acct,
        title: acct.title || acct.name || acct.channelTitle || acct.channelId,
        thumbnail: acct.thumbnails?.default || acct.thumbnails?.medium || acct.thumbnailUrl || acct.thumbnail || '',
        subscriberCount: acct.subscriberCount ?? acct.currentStats?.subscribers ?? 0,
        viewCount: acct.viewCount ?? acct.currentStats?.views ?? 0,
        videoCount: acct.videoCount ?? acct.currentStats?.videos ?? 0,
    };
}
