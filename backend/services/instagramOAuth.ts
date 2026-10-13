import { createOAuthState } from '../lib/oauthState.ts';
import { createAccount, getAccounts } from '../lib/db.ts';
import { fetchInstagramProfile } from './instagramApi.ts';
import { buildInstagramAccount } from './accountFactory.ts';
import type { InstagramApiToken } from './instagramTokens.ts';
import type { Env } from '../types/env.ts';
import type { SupabaseClient } from '../types/app.ts';

const DEFAULT_BACKEND_URL = 'http://localhost:8787';
const DEFAULT_FRONTEND_URL = 'http://localhost:5173';
const CALLBACK_PATH = '/api/auth/instagram/callback';
const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';
const TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const LONG_LIVED_TOKEN_URL = 'https://graph.instagram.com/access_token';
const OAUTH_SCOPES = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights';

export type InstagramOAuthEnv = Pick<Env, 'FRONTEND_URL' | 'BACKEND_URL' | 'INSTAGRAM_APP_ID' | 'INSTAGRAM_APP_SECRET'>;

// appId and appSecret are undefined when the Worker secrets are not set
export interface InstagramOAuthConfig {
    frontendUrl: string;
    redirectUri: string;
    appId: string | undefined;
    appSecret: string | undefined;
}

// what the token exchange needs; urlHandler and callbackHandler check for it first
export interface ConfiguredInstagramOAuth extends InstagramOAuthConfig {
    appId: string;
    appSecret: string;
}

export type InstagramOAuthOutcome = 'already_added' | 'connected';

// answer of the short-lived code exchange at api.instagram.com
interface InstagramApiCodeToken {
    access_token?: string;
    user_id?: string | number;
    permissions?: string[];
    error_type?: string;
    error_message?: string;
    code?: number;
}

// pasted secrets can carry a byte order mark or stray whitespace
function cleanSecret(value: string | undefined): string | undefined {
    return value?.replace(/^\uFEFF/, '').trim();
}

function cleanUrl(value: string | undefined, fallback: string): string {
    return (value || fallback).replace(/^\uFEFF/, '').trim();
}

export function readInstagramOAuthConfig(env: InstagramOAuthEnv): InstagramOAuthConfig {
    const frontendUrl = cleanUrl(env.FRONTEND_URL, DEFAULT_FRONTEND_URL);
    const backendUrl = cleanUrl(env.BACKEND_URL, DEFAULT_BACKEND_URL).replace(/\/$/, '');
    return {
        frontendUrl,
        redirectUri: `${backendUrl}${CALLBACK_PATH}`,
        appId: cleanSecret(env.INSTAGRAM_APP_ID),
        appSecret: cleanSecret(env.INSTAGRAM_APP_SECRET),
    };
}

export function isOAuthConfigured(config: InstagramOAuthConfig): config is ConfiguredInstagramOAuth {
    return !!config.appId && !!config.appSecret;
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

async function exchangeCodeForToken(config: ConfiguredInstagramOAuth, code: string): Promise<string> {
    const tokenRes = await fetch(TOKEN_URL, {
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
    });
    const tokenData = await tokenRes.json() as InstagramApiCodeToken;
    if (!tokenData.access_token) {
        throw new Error(tokenData.error_message || JSON.stringify(tokenData));
    }
    return tokenData.access_token;
}

// keeps the short-lived token (no expiry) when instagram declines the upgrade
async function upgradeToLongLivedToken(config: ConfiguredInstagramOAuth, shortToken: string): Promise<{ token: string; expiresIn: number }> {
    const longParams = new URLSearchParams({
        grant_type: 'ig_exchange_token',
        client_id: config.appId,
        client_secret: config.appSecret,
        access_token: shortToken,
    });
    const longRes = await fetch(`${LONG_LIVED_TOKEN_URL}?${longParams}`);
    const longData = await longRes.json() as InstagramApiToken;
    return { token: longData.access_token || shortToken, expiresIn: longData.expires_in || 0 };
}

export async function connectInstagramFromOAuth(
    supabase: SupabaseClient, userId: string, config: ConfiguredInstagramOAuth, code: string,
): Promise<InstagramOAuthOutcome> {
    const shortToken = await exchangeCodeForToken(config, code);
    const { token, expiresIn } = await upgradeToLongLivedToken(config, shortToken);

    const profile = await fetchInstagramProfile(null, token);
    if (!profile.igUserId) {
        throw new Error('Could not get Instagram User ID. Account must be a Business or Creator account.');
    }

    const existing = await getAccounts(supabase, userId);
    if (existing.find(account => account.platform === 'instagram' && account.igUserId === profile.igUserId)) {
        return 'already_added';
    }

    await createAccount(supabase, buildInstagramAccount(profile, token, expiresIn), userId);
    return 'connected';
}
