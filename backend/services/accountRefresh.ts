import { getAccounts, getAccountById, updateAccount } from '../lib/db.ts';
import { fetchChannelData } from './youtubeChannels.ts';
import { fetchRedditProfile } from './reddit.ts';
import { fetchInstagramProfile } from './instagramApi.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { ServiceFailure } from './accountConnect.ts';
import type { Account, AccountRefreshResult } from '../../shared/types/domain.ts';
import type { YouTubeChannelData } from '../../shared/types/youtube.ts';
import type { RedditProfile } from '../../shared/types/reddit.ts';
import type { InstagramProfile } from '../../shared/types/instagram.ts';

type Credential = 'accessToken' | 'cookie' | 'username' | 'channelId' | 'apiKey';

export type AccountRefreshOutcome = { failure: ServiceFailure; account?: undefined } | { account: Account; failure?: undefined };

export interface RefreshAllOutcome {
    accounts: Account[];
    results: AccountRefreshResult[];
}

const NO_COOKIE_MESSAGE = 'No session cookie stored - re-add this account with a session cookie from reddit.com DevTools';

// known issue: the two refresh paths word a missing YouTube key differently
const NO_USERNAME_MESSAGE = 'No Reddit username stored - delete this account and add it again';
const NO_CHANNEL_MESSAGE = 'No YouTube channel ID stored - delete this channel and add it again';
const SINGLE_REFRESH_MESSAGES: Record<Credential, string> = {
    accessToken: 'No access token', cookie: NO_COOKIE_MESSAGE, username: NO_USERNAME_MESSAGE, channelId: NO_CHANNEL_MESSAGE, apiKey: 'No API key',
};
const REFRESH_ALL_MESSAGES: Record<Credential, string> = { ...SINGLE_REFRESH_MESSAGES, apiKey: 'No YouTube API key' };

function findMissingCredential(account: Account, apiKey: string | undefined): Credential | null {
    if (account.platform === 'instagram') return account.accessToken ? null : 'accessToken';
    if (account.platform === 'reddit') {
        if (!account.username) return 'username';
        return account.cookie ? null : 'cookie';
    }
    if (!account.channelId) return 'channelId';
    return apiKey ? null : 'apiKey';
}

// full adds the fields only a single account refresh updates
function instagramUpdates(profile: InstagramProfile, full: boolean): Partial<Account> {
    const updates = {
        followersCount: profile.followersCount,
        followsCount: profile.followsCount,
        mediaCount: profile.mediaCount,
        title: profile.name || profile.username,
        username: profile.username,
        profilePictureUrl: profile.profilePictureUrl,
    };
    if (!full) return updates;
    return { ...updates, biography: profile.biography, website: profile.website };
}

function redditUpdates(profile: RedditProfile): Partial<Account> {
    return {
        totalKarma: profile.totalKarma,
        postKarma: profile.postKarma,
        commentKarma: profile.commentKarma,
        iconUrl: profile.iconUrl,
    };
}

function youtubeUpdates(channelData: YouTubeChannelData, full: boolean): Partial<Account> {
    const { subscriberCount, viewCount, videoCount, title, thumbnails } = channelData;
    if (!full) return { subscriberCount, viewCount, videoCount, title, thumbnails };
    return {
        subscriberCount, viewCount, videoCount, title,
        description: channelData.description,
        thumbnails,
        customUrl: channelData.customUrl,
        country: channelData.country,
        keywords: channelData.keywords,
        topicCategories: channelData.topicCategories,
    };
}

// fills creation dates on older accounts once; a failure only skips the extras
export async function backfillChannelData(supabase: SupabaseClient, account: Account, apiKey: string, userId: string): Promise<void> {
    if (!account.channelId) return;
    try {
        const channelData = await fetchChannelData(account.channelId, apiKey);
        const updates: Partial<Account> = {
            publishedAt: channelData.publishedAt,
            subscriberCount: channelData.subscriberCount,
            viewCount: channelData.viewCount,
            videoCount: channelData.videoCount,
            title: channelData.title,
            thumbnails: channelData.thumbnails,
            customUrl: channelData.customUrl,
            country: channelData.country,
            lastUpdated: new Date().toISOString(),
        };
        await updateAccount(supabase, account.id, updates, userId);
        Object.assign(account, updates);
    } catch (err) {
        console.error('Failed to backfill channel data:', (err as Error).message);
    }
}

export async function fetchAccountUpdates(account: Account, apiKey: string | undefined, full: boolean): Promise<Partial<Account>> {
    if (account.platform === 'instagram') {
        if (!account.accessToken) throw new Error(SINGLE_REFRESH_MESSAGES.accessToken);
        const profile = await fetchInstagramProfile(account.igUserId, account.accessToken);
        return instagramUpdates(profile, full);
    }
    if (account.platform === 'reddit') {
        if (!account.username) throw new Error(NO_USERNAME_MESSAGE);
        const profile = await fetchRedditProfile(account.username, account.cookie);
        return redditUpdates(profile);
    }
    if (!account.channelId) throw new Error(NO_CHANNEL_MESSAGE);
    if (!apiKey) throw new Error(SINGLE_REFRESH_MESSAGES.apiKey);
    const channelData = await fetchChannelData(account.channelId, apiKey);
    return youtubeUpdates(channelData, full);
}

export async function refreshAccount(supabase: SupabaseClient, userId: string, accountId: string, apiKey: string | undefined): Promise<AccountRefreshOutcome> {
    const account = await getAccountById(supabase, accountId, userId);
    if (!account) return { failure: { status: 404, message: 'Not found' } };

    const lastUpdated = new Date().toISOString();
    const missing = findMissingCredential(account, apiKey);
    if (missing) return { failure: { status: 400, message: SINGLE_REFRESH_MESSAGES[missing] } };

    const updates = { lastUpdated, ...await fetchAccountUpdates(account, apiKey, true) };
    await updateAccount(supabase, account.id, updates, userId);
    return { account: { ...account, ...updates } };
}

async function refreshListedAccount(supabase: SupabaseClient, userId: string, account: Account, apiKey: string | undefined): Promise<string> {
    const lastUpdated = new Date().toISOString();
    const missing = findMissingCredential(account, apiKey);
    if (missing) throw new Error(REFRESH_ALL_MESSAGES[missing]);

    const updates = { lastUpdated, ...await fetchAccountUpdates(account, apiKey, false) };
    await updateAccount(supabase, account.id, updates, userId);
    return account.id;
}

// one failure must not stop the rest; results align with the accounts by index
export async function refreshAllAccounts(supabase: SupabaseClient, userId: string, apiKey: string | undefined): Promise<RefreshAllOutcome> {
    const accounts = await getAccounts(supabase, userId);
    const settled = await Promise.allSettled(accounts.map(account => refreshListedAccount(supabase, userId, account, apiKey)));

    const results: AccountRefreshResult[] = settled.map((outcome, i) => (outcome.status === 'fulfilled'
        ? { id: accounts[i].id, success: true }
        : { id: accounts[i].id, success: false, error: outcome.reason?.message }));

    const updatedAccounts = await getAccounts(supabase, userId);
    return { accounts: updatedAccounts, results };
}
