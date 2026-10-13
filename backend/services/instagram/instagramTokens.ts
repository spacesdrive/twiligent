import { getAccounts, updateAccount } from '../../lib/db.ts';
import { igFetch } from './instagramApi.ts';
import { UpstreamError } from '../../lib/errors.ts';
import type { Account } from '../../../shared/types/domain.ts';
import type { SupabaseClient } from '../../types/app.ts';

const DEFAULT_TOKEN_LIFETIME_S = 5184000;
const REFRESH_WINDOW_MS = 15 * 24 * 60 * 60 * 1000;

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

type ExpiringInstagramAccount = Account & { accessToken: string; tokenExpiresAt: string };

function isInstagramWithToken(account: Account): account is ExpiringInstagramAccount {
    return account.platform === 'instagram' && !!account.accessToken && !!account.tokenExpiresAt;
}

async function refreshStoredToken(supabase: SupabaseClient, account: ExpiringInstagramAccount): Promise<void> {
    try {
        const refreshed = await refreshLongLivedToken(account.accessToken);
        const tokenExpiresAt = new Date(Date.now() + (refreshed.expiresIn || DEFAULT_TOKEN_LIFETIME_S) * 1000).toISOString();
        await updateAccount(supabase, account.id, { accessToken: refreshed.accessToken, tokenExpiresAt });
        console.log(`Token refreshed for @${account.username} - expires ${tokenExpiresAt}`);
    } catch (err) {
        console.error(`Failed to refresh token for @${account.username}: ${(err as Error).message}`);
    }
}

// takes supabase directly because cron handlers have no hono request context
export async function autoRefreshInstagramTokens(supabase: SupabaseClient): Promise<void> {
    try {
        const accounts = await getAccounts(supabase);
        const igAccounts = accounts.filter(isInstagramWithToken);
        if (igAccounts.length === 0) return;

        const soon = new Date(Date.now() + REFRESH_WINDOW_MS);
        const toRefresh = igAccounts.filter(account => new Date(account.tokenExpiresAt!) <= soon);
        if (toRefresh.length === 0) return;

        for (const account of toRefresh) {
            await refreshStoredToken(supabase, account);
        }
    } catch (err) {
        console.error('autoRefreshInstagramTokens error:', (err as Error).message);
    }
}
