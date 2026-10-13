import { igFetch, igPost } from './instagramApi.ts';
import type { GraphParams, InstagramApiContainerStatus, InstagramApiIdResponse } from './instagramApi.ts';
import type {
    InstagramContainerStatusCode, InstagramPublishingLimit, InstagramPublishRequest,
} from '../../../shared/types/instagram.ts';

// query parameters of POST /{ig-user-id}/media; URLSearchParams turns the booleans and numbers into strings
export interface InstagramMediaParams {
    access_token: string;
    media_type?: 'CAROUSEL' | 'VIDEO' | 'REELS' | 'STORIES';
    image_url?: string;
    video_url?: string;
    is_carousel_item?: boolean;
    caption?: string;
    children?: string;
    collaborators?: string;
    location_id?: string;
    share_to_feed?: boolean;
    cover_url?: string;
    audio_name?: string;
    thumb_offset?: number;
    user_tags?: string;
    alt_text?: string;
}

function addCarouselParams(params: InstagramMediaParams, post: InstagramPublishRequest): InstagramMediaParams {
    const { caption, children, collaborators, locationId } = post;
    params.media_type = 'CAROUSEL';
    if (caption) params.caption = caption;
    if (children?.length) params.children = children.join(',');
    if (collaborators?.length) params.collaborators = JSON.stringify(collaborators);
    if (locationId) params.location_id = locationId;
    return params;
}

function addCarouselImageParams(params: InstagramMediaParams, post: InstagramPublishRequest): InstagramMediaParams {
    params.image_url = post.mediaUrl;
    params.is_carousel_item = true;
    return params;
}

function addCarouselVideoParams(params: InstagramMediaParams, post: InstagramPublishRequest): InstagramMediaParams {
    params.media_type = 'VIDEO';
    params.video_url = post.mediaUrl;
    params.is_carousel_item = true;
    return params;
}

function addReelParams(params: InstagramMediaParams, post: InstagramPublishRequest): InstagramMediaParams {
    const { mediaUrl, caption, shareToFeed, coverUrl, collaborators, audioName, thumbOffset, locationId, userTags } = post;
    params.media_type = 'REELS';
    params.video_url = mediaUrl;
    if (caption) params.caption = caption;
    if (shareToFeed !== undefined) params.share_to_feed = shareToFeed;
    if (coverUrl) params.cover_url = coverUrl;
    if (collaborators?.length) params.collaborators = JSON.stringify(collaborators);
    if (audioName) params.audio_name = audioName;
    if (thumbOffset != null) params.thumb_offset = thumbOffset;
    if (locationId) params.location_id = locationId;
    if (userTags?.length) params.user_tags = JSON.stringify(userTags);
    return params;
}

function addStoryParams(params: InstagramMediaParams, post: InstagramPublishRequest): InstagramMediaParams {
    const { mediaUrl, userTags } = post;
    params.media_type = 'STORIES';
    if (mediaUrl?.match(/\.(mp4|mov|avi|webm)/i)) {
        params.video_url = mediaUrl;
    } else {
        params.image_url = mediaUrl;
    }
    if (userTags?.length) params.user_tags = JSON.stringify(userTags);
    return params;
}

function addPhotoParams(params: InstagramMediaParams, post: InstagramPublishRequest): InstagramMediaParams {
    const { mediaUrl, caption, locationId, userTags, altText } = post;
    params.image_url = mediaUrl;
    if (caption) params.caption = caption;
    if (locationId) params.location_id = locationId;
    if (userTags?.length) params.user_tags = JSON.stringify(userTags);
    if (altText) params.alt_text = altText;
    return params;
}

// scripts/publish-scheduled.ts keeps its own copy because it must stay dependency-free
export function buildMediaParams(post: InstagramPublishRequest, accessToken: string): InstagramMediaParams {
    const params: InstagramMediaParams = { access_token: accessToken };
    const { mediaType } = post;
    if (mediaType === 'CAROUSEL') return addCarouselParams(params, post);
    if (mediaType === 'CAROUSEL_ITEM_IMAGE') return addCarouselImageParams(params, post);
    if (mediaType === 'CAROUSEL_ITEM_VIDEO') return addCarouselVideoParams(params, post);
    if (mediaType === 'REELS') return addReelParams(params, post);
    if (mediaType === 'STORIES') return addStoryParams(params, post);
    return addPhotoParams(params, post);
}

export interface ContainerStatus {
    statusCode: InstagramContainerStatusCode;
    status: string;
}

// URLSearchParams turns the boolean and number values into strings
export async function createMediaContainer(igUserId: string, params: InstagramMediaParams, signal?: AbortSignal): Promise<string> {
    const data = await igPost<InstagramApiIdResponse>(`/${igUserId}/media`, params as unknown as GraphParams, signal);
    return data.id;
}

export async function fetchContainerStatus(containerId: string, accessToken: string, signal?: AbortSignal): Promise<ContainerStatus> {
    const data = await igFetch<InstagramApiContainerStatus>(`/${containerId}`, { fields: 'status_code,status', access_token: accessToken }, 1, signal);
    return { statusCode: data.status_code ?? 'IN_PROGRESS', status: data.status ?? '' };
}

export async function publishMediaContainer(igUserId: string, containerId: string, accessToken: string, signal?: AbortSignal): Promise<string> {
    const data = await igPost<InstagramApiIdResponse>(`/${igUserId}/media_publish`, { creation_id: containerId, access_token: accessToken }, signal);
    return data.id;
}

export async function fetchPublishingLimit(igUserId: string, accessToken: string, signal?: AbortSignal): Promise<InstagramPublishingLimit[]> {
    const data = await igFetch<{ data?: InstagramPublishingLimit[] }>(
        `/${igUserId}/content_publishing_limit`, { fields: 'quota_usage,config', access_token: accessToken }, 1, signal,
    );
    return data.data ?? [];
}
