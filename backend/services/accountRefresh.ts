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

type Credential = 'accessToken' | 'cookie' | 'apiKey';

export type AccountRefreshOutcome = { failure: ServiceFailure; account?: undefined } | { account: Account; failure?: undefined };

export interface RefreshAllOutcome {
    accounts: Account[];
    results: AccountRefreshResult[];
}

const NO_COOKIE_MESSAGE = 'No session cookie stored - re-add this account with a session cookie from reddit.com DevTools';

// known issue: the two refresh paths word a missing YouTube key differently
const SINGLE_REFRESH_MESSAGES: Record<Credential, string> = { accessToken: 'No access token', cookie: NO_COOKIE_MESSAGE, apiKey: 'No API key' };
const REFRESH_ALL_MESSAGES: Record<Credential, string> = { accessToken: 'No access token', cookie: NO_COOKIE_MESSAGE, apiKey: 'No YouTube API key' };

function findMissingCredential(account: Account, apiKey: string | undefined): Credential | null {
    if (account.platform === 'instagram') return account.accessToken ? null : 'accessToken';
    if (account.platform === 'reddit') return account.cookie ? null : 'cookie';
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
    try {
        const channelData = await fetchChannelData(account.channelId!, apiKey);
        await updateAccount(supabase, account.id, {
            publishedAt: channelData.publishedAt,
            subscriberCount: channelData.subscriberCount,
            viewCount: channelData.viewCount,
            videoCount: channelData.videoCount,
            title: channelData.title,
            thumbnails: channelData.thumbnails,
            customUrl: channelData.customUrl,
            country: channelData.country,
            lastUpdated: new Date().toISOString(),
        }, userId);
        Object.assign(account, channelData);
    } catch (err) {
        console.error('Failed to backfill channel data:', (err as Error).message);
    }
}

export async function fetchAccountUpdates(account: Account, apiKey: string | undefined, full: boolean): Promise<Partial<Account>> {
    if (account.platform === 'instagram') {
        const profile = await fetchInstagramProfile(account.igUserId, account.accessToken!);
        return instagramUpdates(profile, full);
    }
    if (account.platform === 'reddit') {
        const profile = await fetchRedditProfile(account.username!, account.cookie);
        return redditUpdates(profile);
    }
    const channelData = await fetchChannelData(account.channelId!, apiKey!);
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
