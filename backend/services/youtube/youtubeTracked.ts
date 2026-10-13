import { ytFetch, optionalCount } from './youtubeApi.ts';
import type { YouTubeApiListResponse, YouTubeApiVideo } from './youtubeApi.ts';
import type { YouTubeTrackedVideoData } from '../../../shared/types/youtube.ts';

// requested with part=snippet,statistics only
type TrackedApiVideo = Pick<YouTubeApiVideo, 'id' | 'snippet' | 'statistics'>;

export function extractYouTubeVideoId(url: string): string | null {
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(url.trim());
    } catch {
        // not a url at all, so it has no video id
        return null;
    }

    const { hostname, pathname, searchParams } = parsedUrl;
    if (hostname === 'youtu.be') return pathname.slice(1).split('?')[0];
    if (!hostname.includes('youtube.com')) return null;
    if (pathname.startsWith('/shorts/') || pathname.startsWith('/embed/')) return pathname.split('/')[2];
    return searchParams.get('v');
}

export async function fetchTrackedYouTubeData(videoUrl: string, apiKey: string): Promise<YouTubeTrackedVideoData> {
    const videoId = extractYouTubeVideoId(videoUrl);
    if (!videoId) throw new Error('Invalid YouTube URL - could not extract video ID');

    const data = await ytFetch<YouTubeApiListResponse<TrackedApiVideo>>('videos', {
        part: 'snippet,statistics',
        id: videoId,
    }, apiKey);

    if (!data.items || data.items.length === 0) throw new Error('YouTube video not found - check the URL');

    const { snippet, statistics } = data.items[0];
    const isShort = videoUrl.includes('/shorts/');

    return {
        contentType: 'youtube',
        title: snippet.title,
        channelTitle: snippet.channelTitle,
        channelId: snippet.channelId,
        thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '',
        publishedAt: snippet.publishedAt,
        viewCount: parseInt(statistics.viewCount || '0', 10),
        likeCount: optionalCount(statistics.likeCount),
        commentCount: optionalCount(statistics.commentCount),
        isShort,
        permalink: isShort
            ? `https://www.youtube.com/shorts/${videoId}`
            : `https://www.youtube.com/watch?v=${videoId}`,
        lastFetchedAt: new Date().toISOString(),
    };
}
