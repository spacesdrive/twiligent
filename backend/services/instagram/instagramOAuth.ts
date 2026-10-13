import { createOAuthState } from '../../lib/oauthState.ts';
import { UpstreamError, UpstreamTimeoutError, isAbortError } from '../../lib/errors.ts';
import type { InstagramApiToken } from './instagramTokens.ts';
import type { InstagramOAuthConfig } from '../../lib/config.ts';

const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';
const TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const LONG_LIVED_TOKEN_URL = 'https://graph.instagram.com/access_token';
const OAUTH_SCOPES = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights';

// what the token exchange needs; callers check isOAuthConfigured() first
export interface ConfiguredInstagramOAuth extends InstagramOAuthConfig {
    appId: string;
    appSecret: string;
}

// answer of the short-lived code exchange at api.instagram.com
interface InstagramApiCodeToken {
    access_token?: string;
    user_id?: string | number;
    permissions?: string[];
    error_type?: string;
    error_message?: string;
    code?: number;
}

export interface IssuedInstagramToken {
    token: string;
    expiresIn: number;
}

export function isOAuthConfigured(config: InstagramOAuthConfig): config is ConfiguredInstagramOAuth {
    return !!config.appId && !!config.appSecret;
}

async function instagramRequest(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    try {
        return await fetch(url, { ...init, signal });
    } catch (err) {
        if (isAbortError(err)) throw new UpstreamTimeoutError('Instagram', err);
        throw new UpstreamError(`Instagram API unreachable (${(err as Error).message})`, { cause: err });
    }
}

// the hmac-signed state carries the userId and a timestamp, so no redis is needed
export async function buildAuthorizationUrl(config: ConfiguredInstagramOAuth, userId: string): Promise<string> {
    const state = await createOAuthState(userId, config.appSecret);
    const params = new URLSearchParams({
        force_reauth: 'true',
        client_id: config.appId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: OAUTH_SCOPES,
        state,
    });
    return `${AUTHORIZE_URL}?${params}`;
}

export async function exchangeCodeForToken(config: ConfiguredInstagramOAuth, code: string, signal?: AbortSignal): Promise<string> {
    const tokenRes = await instagramRequest(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: config.appId,
            client_secret: config.appSecret,
            grant_type: 'authorization_code',
            redirect_uri: config.redirectUri,
            // instagram sometimes appends #_ to the code
            code: code.replace(/#.*$/, ''),
        }),
    }, signal);
    const tokenData = await tokenRes.json() as InstagramApiCodeToken;
    if (!tokenData.access_token) {
        throw new UpstreamError(tokenData.error_message || JSON.stringify(tokenData));
    }
    return tokenData.access_token;
}

// keeps the short-lived token (no expiry) when instagram declines the upgrade
export async function upgradeToLongLivedToken(config: ConfiguredInstagramOAuth, shortToken: string, signal?: AbortSignal): Promise<IssuedInstagramToken> {
    const longParams = new URLSearchParams({
        grant_type: 'ig_exchange_token',
        client_id: config.appId,
        client_secret: config.appSecret,
        access_token: shortToken,
    });
    const longRes = await instagramRequest(`${LONG_LIVED_TOKEN_URL}?${longParams}`, {}, signal);
    const longData = await longRes.json() as InstagramApiToken;
    return { token: longData.access_token || shortToken, expiresIn: longData.expires_in || 0 };
}
