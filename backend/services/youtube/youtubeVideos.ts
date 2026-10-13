import { ytFetch, optionalCount } from './youtubeApi.ts';
import type { YouTubeApiError, YouTubeApiListResponse, YouTubeApiParams, YouTubeApiPlaylistItem, YouTubeApiVideo } from './youtubeApi.ts';
import type { YouTubeVideo } from '../../../shared/types/youtube.ts';

export function normalizeYouTubeVideo(video: YouTubeApiVideo): YouTubeVideo {
    const { snippet, contentDetails, statistics, status } = video;
    return {
        videoId: video.id,
        title: snippet.title,
        description: snippet.description?.substring(0, 200) || '',
        publishedAt: snippet.publishedAt,
        channelTitle: snippet.channelTitle,
        thumbnails: {
            default: snippet.thumbnails?.default?.url || '',
            medium: snippet.thumbnails?.medium?.url || '',
            high: snippet.thumbnails?.high?.url || '',
        },
        tags: snippet.tags || [],
        categoryId: snippet.categoryId || '',
        liveBroadcastContent: snippet.liveBroadcastContent || 'none',
        defaultAudioLanguage: snippet.defaultAudioLanguage || '',
        duration: contentDetails.duration,
        dimension: contentDetails.dimension || '2d',
        definition: contentDetails.definition || 'hd',
        caption: contentDetails.caption === 'true',
        licensedContent: contentDetails.licensedContent || false,
        projection: contentDetails.projection || 'rectangular',
        viewCount: parseInt(statistics.viewCount) || 0,
        // null when likes are hidden or comments are off, so it stays apart from zero
        likeCount: optionalCount(statistics.likeCount),
        commentCount: optionalCount(statistics.commentCount),
        privacyStatus: status?.privacyStatus || 'public',
        embeddable: status?.embeddable || false,
        madeForKids: status?.madeForKids || false,
    };
}

async function fetchPlaylistPage(
    playlistId: string, pageToken: string, apiKey: string,
): Promise<YouTubeApiListResponse<YouTubeApiPlaylistItem> | null> {
    const params: YouTubeApiParams = { part: 'snippet,contentDetails', playlistId, maxResults: '50' };
    if (pageToken) params.pageToken = pageToken;
    try {
        return await ytFetch<YouTubeApiListResponse<YouTubeApiPlaylistItem>>('playlistItems', params, apiKey);
    } catch (err) {
        // youtube reports the uploads playlist missing until the first public video
        if ((err as YouTubeApiError).reason === 'playlistNotFound') return null;
        throw err;
    }
}

async function fetchVideoDetails(playlistItems: YouTubeApiPlaylistItem[], apiKey: string): Promise<YouTubeVideo[]> {
    const videoIds = playlistItems.map(item => item.snippet.resourceId.videoId).join(',');
    const statsData = await ytFetch<YouTubeApiListResponse<YouTubeApiVideo>>('videos', {
        part: 'statistics,contentDetails,snippet,status',
        id: videoIds,
    }, apiKey);
    return statsData.items ? statsData.items.map(normalizeYouTubeVideo) : [];
}

export async function fetchAllVideos(playlistId: string, apiKey: string, maxPages = 10): Promise<YouTubeVideo[]> {
    const allVideos: YouTubeVideo[] = [];
    let pageToken = '';
    let page = 0;

    while (page < maxPages) {
        const data = await fetchPlaylistPage(playlistId, pageToken, apiKey);
        if (!data || !data.items || data.items.length === 0) break;

        allVideos.push(...await fetchVideoDetails(data.items, apiKey));

        pageToken = data.nextPageToken || '';
        if (!pageToken) break;
        page++;
    }

    return allVideos;
}
