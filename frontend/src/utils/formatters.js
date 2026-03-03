export function fmtNum(n) {
    if (n == null) return '0';
    n = Number(n);
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
}

export function fmtNumFull(n) {
    if (n == null) return '0';
    return Number(n).toLocaleString();
}

export function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtDateShort(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fmtDuration(seconds) {
    if (!seconds) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtPercent(n) {
    if (n == null) return '0%';
    return Number(n).toFixed(1) + '%';
}

export function timeAgo(date) {
    if (!date) return 'Never';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
}

export const CATEGORY_MAP = {
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

// Normalize account data (handles both old/new backend formats and Instagram)
export function normalizeAccount(acct) {
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
