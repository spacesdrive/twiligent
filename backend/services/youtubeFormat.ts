// ignores the day part, so durations such as P1DT2H parse as zero seconds
export function parseDuration(iso) {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    return (parseInt(match[1] || 0) * 3600) + (parseInt(match[2] || 0) * 60) + parseInt(match[3] || 0);
}

export function formatCompact(value) {
    if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
    return value.toString();
}

export function formatDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`;
}

export function formatVideoSummary(video) {
    if (!video) return null;
    return {
        videoId: video.videoId, title: video.title, viewCount: video.viewCount,
        likeCount: video.likeCount, commentCount: video.commentCount,
        publishedAt: video.publishedAt,
        thumbnail: video.thumbnails?.medium || video.thumbnails?.default || '',
        engagementRate: video.engagementRate?.toFixed(2) || 0,
        durationSeconds: video.durationSeconds || parseDuration(video.duration),
    };
}
