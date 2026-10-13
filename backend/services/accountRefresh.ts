import { getAccounts, getAccountById, updateAccount } from '../lib/db.ts';
import { fetchChannelData } from './youtubeChannels.ts';
import { fetchRedditProfile } from './reddit.ts';
import { fetchInstagramProfile } from './instagramApi.ts';

const NO_COOKIE_MESSAGE = 'No session cookie stored - re-add this account with a session cookie from reddit.com DevTools';

// known issue: the two refresh paths word a missing YouTube key differently
const SINGLE_REFRESH_MESSAGES = { accessToken: 'No access token', cookie: NO_COOKIE_MESSAGE, apiKey: 'No API key' };
const REFRESH_ALL_MESSAGES = { accessToken: 'No access token', cookie: NO_COOKIE_MESSAGE, apiKey: 'No YouTube API key' };

function findMissingCredential(account, apiKey) {
    if (account.platform === 'instagram') return account.accessToken ? null : 'accessToken';
    if (account.platform === 'reddit') return account.cookie ? null : 'cookie';
    return apiKey ? null : 'apiKey';
}

// full adds the fields only a single account refresh updates
function instagramUpdates(profile, full) {
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

function redditUpdates(profile) {
    return {
        totalKarma: profile.totalKarma,
        postKarma: profile.postKarma,
        commentKarma: profile.commentKarma,
        iconUrl: profile.iconUrl,
    };
}

function youtubeUpdates(channelData, full) {
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
export async function backfillChannelData(supabase, account, apiKey, userId) {
    try {
        const channelData = await fetchChannelData(account.channelId, apiKey);
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
        console.error('Failed to backfill channel data:', err.message);
    }
}

export async function fetchAccountUpdates(account, apiKey, full) {
    if (account.platform === 'instagram') {
        const profile = await fetchInstagramProfile(account.igUserId, account.accessToken);
        return instagramUpdates(profile, full);
    }
    if (account.platform === 'reddit') {
        const profile = await fetchRedditProfile(account.username, account.cookie);
        return redditUpdates(profile);
    }
    const channelData = await fetchChannelData(account.channelId, apiKey);
    return youtubeUpdates(channelData, full);
}

export async function refreshAccount(supabase, userId, accountId, apiKey) {
    const account = await getAccountById(supabase, accountId, userId);
    if (!account) return { failure: { status: 404, message: 'Not found' } };

    const lastUpdated = new Date().toISOString();
    const missing = findMissingCredential(account, apiKey);
    if (missing) return { failure: { status: 400, message: SINGLE_REFRESH_MESSAGES[missing] } };

    const updates = { lastUpdated, ...await fetchAccountUpdates(account, apiKey, true) };
    await updateAccount(supabase, account.id, updates, userId);
    return { account: { ...account, ...updates } };
}

async function refreshListedAccount(supabase, userId, account, apiKey) {
    const lastUpdated = new Date().toISOString();
    const missing = findMissingCredential(account, apiKey);
    if (missing) throw new Error(REFRESH_ALL_MESSAGES[missing]);

    const updates = { lastUpdated, ...await fetchAccountUpdates(account, apiKey, false) };
    await updateAccount(supabase, account.id, updates, userId);
    return account.id;
}

// one failure must not stop the rest; results align with the accounts by index
export async function refreshAllAccounts(supabase, userId, apiKey) {
    const accounts = await getAccounts(supabase, userId);
    const settled = await Promise.allSettled(accounts.map(account => refreshListedAccount(supabase, userId, account, apiKey)));

    const results = settled.map((outcome, i) => (outcome.status === 'fulfilled'
        ? { id: accounts[i].id, success: true }
        : { id: accounts[i].id, success: false, error: outcome.reason?.message }));

    const updatedAccounts = await getAccounts(supabase, userId);
    return { accounts: updatedAccounts, results };
}
