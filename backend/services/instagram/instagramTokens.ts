import { igFetch } from './instagramApi.ts';
import { UpstreamError } from '../../lib/errors.ts';

const DEFAULT_TOKEN_LIFETIME_S = 5184000;

// answer of /access_token and /refresh_access_token
export interface InstagramApiToken {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
}

type IssuedToken = InstagramApiToken & { access_token: string };

export interface InstagramTokenResult {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
}

function toTokenResult(data: IssuedToken): InstagramTokenResult {
    return {
        accessToken: data.access_token,
        tokenType: data.token_type || 'bearer',
        expiresIn: data.expires_in || DEFAULT_TOKEN_LIFETIME_S,
    };
}

export async function exchangeForLongLivedToken(shortToken: string, appSecret: string, signal?: AbortSignal): Promise<InstagramTokenResult> {
    const data = await igFetch<InstagramApiToken>('/access_token', {
        grant_type: 'ig_exchange_token',
        client_secret: appSecret,
        access_token: shortToken,
    }, 1, signal);
    if (!data.access_token) throw new UpstreamError('Failed to exchange token - check Instagram App Secret');
    return toTokenResult(data as IssuedToken);
}

export async function refreshLongLivedToken(longToken: string, signal?: AbortSignal): Promise<InstagramTokenResult> {
    const data = await igFetch<InstagramApiToken>('/refresh_access_token', {
        grant_type: 'ig_refresh_token',
        access_token: longToken,
    }, 1, signal);
    if (!data.access_token) throw new UpstreamError('Failed to refresh token');
    return toTokenResult(data as IssuedToken);
}
