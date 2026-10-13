import type { InstagramContainerStatusCode, InstagramProfile } from '../../shared/types/instagram.ts';

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
    return err.name === 'AbortError' ||
        err.message?.includes('EAI_AGAIN') ||
        err.message?.includes('ECONNRESET');
}

function readGraphResponse<T>(data: T & InstagramApiErrorBody): T {
    if (data.error) throw new Error(data.error.message || data.error.error_message || JSON.stringify(data.error));
    if (data.error_message) throw new Error(data.error_message);
    return data;
}

export async function igFetch<T = unknown>(endpoint: string, params: GraphParams = {}, retries = 1): Promise<T> {
    const url = buildGraphUrl(endpoint, params);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
        response = await fetch(url.toString(), { signal: controller.signal });
    } catch (err) {
        clearTimeout(timer);
        if (isTransientError(err as Error) && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            return igFetch<T>(endpoint, params, retries - 1);
        }
        if ((err as Error).name === 'AbortError') throw new Error('Instagram API request timed out');
        throw new Error(`Instagram API unreachable (${(err as Error).message})`);
    }
    clearTimeout(timer);

    return readGraphResponse(await response.json() as T & InstagramApiErrorBody);
}

export async function fetchInstagramProfile(igUserId: string | null | undefined, accessToken: string): Promise<InstagramProfile> {
    const endpoint = igUserId ? `/${igUserId}` : '/me';
    const data = await igFetch<InstagramApiProfile>(endpoint, {
        access_token: accessToken,
        fields: 'user_id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website',
    });
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
