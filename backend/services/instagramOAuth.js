import { createOAuthState } from '../lib/oauthState.js';
import { createAccount, getAccounts } from '../lib/db.js';
import { fetchInstagramProfile } from './instagramApi.js';
import { buildInstagramAccount } from './accountFactory.js';

const DEFAULT_BACKEND_URL = 'http://localhost:8787';
const DEFAULT_FRONTEND_URL = 'http://localhost:5173';
const CALLBACK_PATH = '/api/auth/instagram/callback';
const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';
const TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const LONG_LIVED_TOKEN_URL = 'https://graph.instagram.com/access_token';
const OAUTH_SCOPES = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights';

// secrets pasted into the dashboard can carry a byte order mark or stray whitespace
function cleanSecret(value) {
    return value?.replace(/^﻿/, '').trim();
}

function cleanUrl(value, fallback) {
    return (value || fallback).replace(/^﻿/, '').trim();
}

export function readInstagramOAuthConfig(env) {
    const frontendUrl = cleanUrl(env.FRONTEND_URL, DEFAULT_FRONTEND_URL);
    const backendUrl = cleanUrl(env.BACKEND_URL, DEFAULT_BACKEND_URL).replace(/\/$/, '');
    return {
        frontendUrl,
        redirectUri: `${backendUrl}${CALLBACK_PATH}`,
        appId: cleanSecret(env.INSTAGRAM_APP_ID),
        appSecret: cleanSecret(env.INSTAGRAM_APP_SECRET),
    };
}

// the hmac-signed state carries the userId and a timestamp, so no redis is needed
export async function buildAuthorizationUrl(config, userId) {
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

async function exchangeCodeForToken(config, code) {
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
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
        throw new Error(tokenData.error_message || JSON.stringify(tokenData));
    }
    return tokenData.access_token;
}

// keeps the short-lived token, with no expiry, when instagram declines the 60 day upgrade
async function upgradeToLongLivedToken(config, shortToken) {
    const longParams = new URLSearchParams({
        grant_type: 'ig_exchange_token',
        client_id: config.appId,
        client_secret: config.appSecret,
        access_token: shortToken,
    });
    const longRes = await fetch(`${LONG_LIVED_TOKEN_URL}?${longParams}`);
    const longData = await longRes.json();
    return { token: longData.access_token || shortToken, expiresIn: longData.expires_in || 0 };
}

export async function connectInstagramFromOAuth(supabase, userId, config, code) {
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
