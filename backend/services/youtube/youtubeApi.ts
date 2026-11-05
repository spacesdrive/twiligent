import { createCircuitBreaker } from '../../lib/circuitBreaker.ts';
import { UpstreamError, UpstreamTimeoutError, isAbortError } from '../../lib/errors.ts';
import { unitsFor } from '../../lib/youtubeQuota.ts';

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

export const youtubeCircuit = createCircuitBreaker('YouTube');

// the operator's API key, with the meter that counts the quota units each call spends for the member it serves
export interface MeteredYouTubeKey {
    key: string;
    spend(units: number): void;
}

export type YouTubeKey = string | MeteredYouTubeKey;

// adds the key to the caller's params object, as callers always pass a fresh one; YouTube charges a call's units even when
// it fails, so they are counted before it goes out
export function ytFetch<T>(endpoint: string, params: YouTubeApiParams, apiKey: YouTubeKey, signal?: AbortSignal): Promise<T> {
    if (typeof apiKey !== 'string') apiKey.spend(unitsFor(endpoint));
    const key = typeof apiKey === 'string' ? apiKey : apiKey.key;
    return youtubeCircuit.run(() => requestYouTube<T>(endpoint, params, key, signal), signal);
}

async function requestYouTube<T>(endpoint: string, params: YouTubeApiParams, apiKey: string, signal?: AbortSignal): Promise<T> {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    params.key = apiKey;
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    let response: Response;
    try {
        response = await fetch(url.toString(), { signal });
    } catch (err) {
        if (isAbortError(err)) throw new UpstreamTimeoutError('YouTube', err);
        throw new UpstreamError(`YouTube could not be reached (${(err as Error).message})`, { reason: 'unreachable', cause: err });
    }
    const data = await response.json() as T & YouTubeApiErrorBody;
    if (data.error) {
        throw new UpstreamError(data.error.message, { reason: data.error.errors?.[0]?.reason || '', status: data.error.code });
    }
    return data;
}

export function optionalCount(value: string | null | undefined): number | null {
    if (value == null) return null;
    const count = parseInt(value, 10);
    return Number.isFinite(count) ? count : null;
}
