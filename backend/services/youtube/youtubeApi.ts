export type YouTubeApiParams = Record<string, string>;

export interface YouTubeApiThumbnail {
    url: string;
    width?: number;
    height?: number;
}

export type YouTubeApiThumbnails = Partial<Record<'default' | 'medium' | 'high' | 'standard' | 'maxres', YouTubeApiThumbnail>>;

export interface YouTubeApiListResponse<TItem> {
    items?: TItem[];
    nextPageToken?: string;
    pageInfo?: { totalResults: number; resultsPerPage: number };
}

export interface YouTubeApiErrorBody {
    error?: {
        code: number;
        message: string;
        errors?: { reason?: string; message?: string; domain?: string }[];
    };
}

export interface YouTubeApiError extends Error {
    reason?: string;
    status?: number;
}

export interface YouTubeApiChannel {
    id: string;
    snippet: {
        title: string;
        description: string;
        customUrl?: string;
        publishedAt: string;
        country?: string;
        thumbnails?: YouTubeApiThumbnails;
    };
    statistics: {
        subscriberCount: string;
        viewCount: string;
        videoCount: string;
        hiddenSubscriberCount?: boolean;
    };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
    brandingSettings?: { channel?: { keywords?: string }; image?: { bannerExternalUrl?: string } };
    status?: { madeForKids?: boolean; isLinked?: boolean };
    topicDetails?: { topicCategories?: string[] };
}

export interface YouTubeApiSearchResult {
    id: { kind: string; channelId?: string; videoId?: string };
    snippet: { channelId: string; title?: string };
}

export interface YouTubeApiPlaylistItem {
    snippet: { resourceId: { videoId: string } };
    contentDetails?: { videoId: string; videoPublishedAt?: string };
}

export interface YouTubeApiVideo {
    id: string;
    snippet: {
        title: string;
        description?: string;
        publishedAt: string;
        channelId: string;
        channelTitle: string;
        thumbnails?: YouTubeApiThumbnails;
        tags?: string[];
        categoryId?: string;
        liveBroadcastContent?: string;
        defaultAudioLanguage?: string;
    };
    contentDetails: {
        duration: string;
        dimension?: string;
        definition?: string;
        caption?: string;
        licensedContent?: boolean;
        projection?: string;
    };
    // youtube leaves likeCount and commentCount out when they are hidden or turned off
    statistics: {
        viewCount: string;
        likeCount?: string;
        commentCount?: string;
    };
    status?: { privacyStatus?: string; embeddable?: boolean; madeForKids?: boolean };
}

// adds the key to the caller's params object, as callers always pass a fresh one
export async function ytFetch<T>(endpoint: string, params: YouTubeApiParams, apiKey: string): Promise<T> {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    params.key = apiKey;
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url.toString());
    const data = await response.json() as T & YouTubeApiErrorBody;
    if (data.error) {
        const err: YouTubeApiError = new Error(data.error.message);
        err.reason = data.error.errors?.[0]?.reason || '';
        err.status = data.error.code;
        throw err;
    }
    return data;
}

export function optionalCount(value: string | null | undefined): number | null {
    if (value == null) return null;
    const count = parseInt(value, 10);
    return Number.isFinite(count) ? count : null;
}
