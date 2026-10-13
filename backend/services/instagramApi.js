// fetch is a global in Cloudflare Workers - no import needed.

const IG_GRAPH_URL = 'https://graph.instagram.com';
const IG_API_VERSION = 'v25.0';
const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 1000;
const UNVERSIONED_PREFIXES = ['/oauth', '/access_token', '/refresh_access_token'];

function buildGraphUrl(endpoint, params) {
    const needsVersion = !UNVERSIONED_PREFIXES.some(prefix => endpoint.startsWith(prefix));
    const base = needsVersion ? `${IG_GRAPH_URL}/${IG_API_VERSION}` : IG_GRAPH_URL;
    const url = new URL(`${base}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return url;
}

function isTransientError(err) {
    return err.name === 'AbortError' ||
        err.message?.includes('EAI_AGAIN') ||
        err.message?.includes('ECONNRESET');
}

function readGraphResponse(data) {
    if (data.error) throw new Error(data.error.message || data.error.error_message || JSON.stringify(data.error));
    if (data.error_message) throw new Error(data.error_message);
    return data;
}

export async function igFetch(endpoint, params = {}, retries = 1) {
    const url = buildGraphUrl(endpoint, params);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response;
    try {
        response = await fetch(url.toString(), { signal: controller.signal });
    } catch (err) {
        clearTimeout(timer);
        if (isTransientError(err) && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            return igFetch(endpoint, params, retries - 1);
        }
        if (err.name === 'AbortError') throw new Error('Instagram API request timed out');
        throw new Error(`Instagram API unreachable (${err.message})`);
    }
    clearTimeout(timer);

    return readGraphResponse(await response.json());
}

export async function fetchInstagramProfile(igUserId, accessToken) {
    const endpoint = igUserId ? `/${igUserId}` : '/me';
    const data = await igFetch(endpoint, {
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
