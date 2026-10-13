import { getAccounts, getAccountById, createAccount, updateAccount } from '../lib/db.ts';
import { resolveChannelId, fetchChannelData } from './youtube/youtubeChannels.ts';
import { fetchRedditProfile } from './reddit/redditApi.ts';
import { fetchInstagramProfile } from './instagram/instagramApi.ts';
import { exchangeForLongLivedToken, refreshLongLivedToken } from './instagram/instagramTokens.ts';
import { buildYouTubeAccount, buildRedditAccount, buildInstagramAccount } from './accountFactory.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { Account, NewAccount } from '../../shared/types/domain.ts';

export interface ServiceFailure {
    status: 400 | 404;
    message: string;
}

export type TokenRefreshOutcome = { failure: ServiceFailure; expiresAt?: undefined } | { expiresAt: string; failure?: undefined };

interface PastedToken {
    token: string;
    expiresIn: number;
}

const DEFAULT_TOKEN_LIFETIME_S = 5184000;

// duplicates throw like other failures; the route answers all with a 400
export async function addYouTubeAccount(supabase: SupabaseClient, userId: string, input: string, apiKey: string): Promise<NewAccount> {
    const channelId = await resolveChannelId(input, apiKey);
    const [channelData, accounts] = await Promise.all([
        fetchChannelData(channelId, apiKey),
        getAccounts(supabase, userId),
    ]);

    if (accounts.find(account => account.channelId === channelId)) {
        throw new Error('This channel is already added');
    }

    const newAccount = buildYouTubeAccount(channelData);
    await createAccount(supabase, newAccount, userId);
    return newAccount;
}

export async function addRedditAccount(supabase: SupabaseClient, userId: string, username: string, cookie: string): Promise<Account> {
    const cleanUsername = username.replace(/^u\//i, '').trim();
    const profile = await fetchRedditProfile(cleanUsername, cookie);

    const accounts = await getAccounts(supabase, userId);
    if (accounts.find(account => account.platform === 'reddit' && account.username === profile.username)) {
        throw new Error('This Reddit account is already added');
    }

    const newAccount = buildRedditAccount(profile, cookie);
    await createAccount(supabase, newAccount, userId);
    return newAccount;
}

// a pasted token may already be long-lived, so a failed exchange keeps it as is
async function exchangePastedToken(accessToken: string, appSecret: string | undefined): Promise<PastedToken> {
    if (!appSecret) return { token: accessToken, expiresIn: 0 };
    try {
        const longToken = await exchangeForLongLivedToken(accessToken, appSecret);
        return { token: longToken.accessToken, expiresIn: longToken.expiresIn };
    } catch (err) {
        console.log('Token exchange skipped (token may already be long-lived):', (err as Error).message);
        return { token: accessToken, expiresIn: 0 };
    }
}

export async function addInstagramAccount(supabase: SupabaseClient, userId: string, accessToken: string, appSecret: string | undefined): Promise<Account> {
    const { token, expiresIn } = await exchangePastedToken(accessToken, appSecret);

    const profile = await fetchInstagramProfile(null, token);
    if (!profile.igUserId) {
        throw new Error('Could not get Instagram User ID. Make sure the token has instagram_business_basic permission and is from a Business/Creator account.');
    }

    const accounts = await getAccounts(supabase, userId);
    if (accounts.find(account => account.platform === 'instagram' && account.igUserId === profile.igUserId)) {
        throw new Error('This Instagram account is already added');
    }

    const newAccount = buildInstagramAccount(profile, token, expiresIn);
    await createAccount(supabase, newAccount, userId);
    return newAccount;
}

export async function refreshInstagramToken(supabase: SupabaseClient, userId: string, accountId: string): Promise<TokenRefreshOutcome> {
    const account = await getAccountById(supabase, accountId, userId);
    if (!account || account.platform !== 'instagram') {
        return { failure: { status: 404, message: 'Instagram account not found' } };
    }
    if (!account.accessToken) {
        return { failure: { status: 400, message: 'No access token stored' } };
    }

    const refreshed = await refreshLongLivedToken(account.accessToken);
    const tokenExpiresAt = new Date(Date.now() + (refreshed.expiresIn || DEFAULT_TOKEN_LIFETIME_S) * 1000).toISOString();
    await updateAccount(supabase, account.id, { accessToken: refreshed.accessToken, tokenExpiresAt }, userId);
    return { expiresAt: tokenExpiresAt };
}
