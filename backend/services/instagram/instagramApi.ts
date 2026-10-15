import { UpstreamError, UpstreamTimeoutError } from '../../lib/errors.ts';
import type { InstagramContainerStatusCode, InstagramProfile } from '../../../shared/types/instagram.ts';

const IG_GRAPH_URL = 'https://graph.instagram.com';
const IG_API_VERSION = 'v25.0';
const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 1000;
const UNVERSIONED_PREFIXES = ['/oauth', '/access_token', '/refresh_access_token'];

export type GraphParams = Record<string, string>;

export interface InstagramApiError {
    message?: string;
    error_message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
}

// every Graph API failure carries one of these two fields
export interface InstagramApiErrorBody {
    error?: InstagramApiError;
    error_message?: string;
}

// container creation and media_publish both answer with the new object id
export interface InstagramApiIdResponse extends InstagramApiErrorBody {
    id: string;
}

export interface InstagramApiContainerStatus extends InstagramApiErrorBody {
    id?: string;
    status_code?: InstagramContainerStatusCode;
    status?: string;
}

interface InstagramApiProfile {
    id?: string;
    user_id?: string;
    username?: string;
    name?: string;
    profile_picture_url?: string;
    followers_count?: number;
    follows_count?: number;
    media_count?: number;
    biography?: string;
    website?: string;
}

function buildGraphUrl(endpoint: string, params: GraphParams): URL {
    const needsVersion = !UNVERSIONED_PREFIXES.some(prefix => endpoint.startsWith(prefix));
    const base = needsVersion ? `${IG_GRAPH_URL}/${IG_API_VERSION}` : IG_GRAPH_URL;
    const url = new URL(`${base}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return url;
}

function isTransientError(err: Error): boolean | undefined {
    return err.name === 'AbortError' || err.name === 'TimeoutError' ||
        err.message?.includes('EAI_AGAIN') ||
        err.message?.includes('ECONNRESET');
}

export function readGraphResponse<T>(data: T & InstagramApiErrorBody): T {
    if (data.error) {
        throw new UpstreamError(data.error.message || data.error.error_message || JSON.stringify(data.error), { status: data.error.code });
    }
    if (data.error_message) throw new UpstreamError(data.error_message);
    return data;
}

function unreachable(err: unknown): Error {
    return new UpstreamError(`Instagram API unreachable (${(err as Error).message})`, { reason: 'unreachable', cause: err });
}

// GET with a 15 second timeout and one retry on a network blip; a cancelled request is never retried
export async function igFetch<T = unknown>(endpoint: string, params: GraphParams = {}, retries = 1, signal?: AbortSignal): Promise<T> {
    const url = buildGraphUrl(endpoint, params);
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
        response = await fetch(url.toString(), { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    } catch (err) {
        if (signal?.aborted) throw new UpstreamTimeoutError('Instagram', err);
        if (isTransientError(err as Error) && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            return igFetch<T>(endpoint, params, retries - 1, signal);
        }
        if ((err as Error).name === 'AbortError' || (err as Error).name === 'TimeoutError') throw new UpstreamTimeoutError('Instagram', err);
        throw unreachable(err);
    }

    return readGraphResponse(await response.json() as T & InstagramApiErrorBody);
}

// POST is never retried: a repeated media_publish could publish the post twice
export async function igPost<T = unknown>(endpoint: string, params: GraphParams, signal?: AbortSignal): Promise<T> {
    const url = buildGraphUrl(endpoint, params);
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
        response = await fetch(url.toString(), { method: 'POST', signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    } catch (err) {
        if (signal?.aborted || (err as Error).name === 'AbortError' || (err as Error).name === 'TimeoutError') {
            throw new UpstreamTimeoutError('Instagram', err);
        }
        throw unreachable(err);
    }
    return readGraphResponse(await response.json() as T & InstagramApiErrorBody);
}

export async function fetchInstagramProfile(igUserId: string | null | undefined, accessToken: string, signal?: AbortSignal): Promise<InstagramProfile> {
    const endpoint = igUserId ? `/${igUserId}` : '/me';
    const data = await igFetch<InstagramApiProfile>(endpoint, {
        access_token: accessToken,
        fields: 'user_id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website',
    }, 1, signal);
    return {
        igUserId: data.user_id || data.id || igUserId,
        name: data.name || '',
        username: data.username || '',
        profilePictureUrl: data.profile_picture_url || '',
        followersCount: data.followers_count || 0,
        followsCount: data.follows_count || 0,
        mediaCount: data.media_count || 0,
        biography: data.biography || '',
        website: data.website || '',
    };
}
