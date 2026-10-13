import { getAccounts, updateAccount } from '../lib/db.js';
import { igFetch } from './instagramApi.js';

const DEFAULT_TOKEN_LIFETIME_S = 5184000;
const REFRESH_WINDOW_MS = 15 * 24 * 60 * 60 * 1000;

function toTokenResult(data) {
    return {
        accessToken: data.access_token,
        tokenType: data.token_type || 'bearer',
        expiresIn: data.expires_in || DEFAULT_TOKEN_LIFETIME_S,
    };
}

export async function exchangeForLongLivedToken(shortToken, appSecret) {
    const data = await igFetch('/access_token', {
        grant_type: 'ig_exchange_token',
        client_secret: appSecret,
        access_token: shortToken,
    });
    if (!data.access_token) throw new Error('Failed to exchange token - check Instagram App Secret');
    return toTokenResult(data);
}

export async function refreshLongLivedToken(longToken) {
    const data = await igFetch('/refresh_access_token', {
        grant_type: 'ig_refresh_token',
        access_token: longToken,
    });
    if (!data.access_token) throw new Error('Failed to refresh token');
    return toTokenResult(data);
}

function isInstagramWithToken(account) {
    return account.platform === 'instagram' && account.accessToken && account.tokenExpiresAt;
}

async function refreshStoredToken(supabase, account) {
    try {
        const refreshed = await refreshLongLivedToken(account.accessToken);
        const tokenExpiresAt = new Date(Date.now() + (refreshed.expiresIn || DEFAULT_TOKEN_LIFETIME_S) * 1000).toISOString();
        await updateAccount(supabase, account.id, { accessToken: refreshed.accessToken, tokenExpiresAt });
        console.log(`Token refreshed for @${account.username} - expires ${tokenExpiresAt}`);
    } catch (err) {
        console.error(`Failed to refresh token for @${account.username}: ${err.message}`);
    }
}

// takes supabase directly because cron handlers have no hono request context
export async function autoRefreshInstagramTokens(supabase) {
    try {
        const accounts = await getAccounts(supabase);
        const igAccounts = accounts.filter(isInstagramWithToken);
        if (igAccounts.length === 0) return;

        const soon = new Date(Date.now() + REFRESH_WINDOW_MS);
        const toRefresh = igAccounts.filter(account => new Date(account.tokenExpiresAt) <= soon);
        if (toRefresh.length === 0) return;

        for (const account of toRefresh) {
            await refreshStoredToken(supabase, account);
        }
    } catch (err) {
        console.error('autoRefreshInstagramTokens error:', err.message);
    }
}
