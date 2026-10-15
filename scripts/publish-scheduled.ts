#!/usr/bin/env node
// Instagram scheduled post publisher, run by GitHub Actions every 15 minutes with no npm install.
// Node 22.18+ runs this file directly by stripping its types; it needs SUPABASE_URL and
// SUPABASE_SERVICE_KEY (a sb_secret_ key or the legacy service_role key) as GitHub secrets.

import {
    MAX_PUBLISH_ATTEMPTS, containerStep, failureMessage, failureOutcome, isTransientGraphCode, staleClaimCutoff,
} from '../backend/lib/scheduledPublishing.ts';
import type { Account, Platform, PostStatus, ScheduledPost } from '../shared/types/domain.ts';
import type { InstagramContainerStatusCode } from '../shared/types/instagram.ts';

interface AccountRow {
    id: string;
    platform: Platform;
    data: Omit<Account, 'id' | 'platform'> | null;
}

interface ScheduledPostRow {
    id: string;
    account_id: string;
    status: PostStatus;
    scheduled_at: string;
    claimed_at: string | null;
    attempts: number | null;
    data: Partial<ScheduledPost> | null;
}

interface GraphResponse {
    id?: string;
    error?: { message: string; code?: number };
    status_code?: InstagramContainerStatusCode;
    status?: string;
}

// the account and container an attempt reached, which the error path needs to ask Instagram what happened
interface Attempt {
    account: Account | null;
    containerId: string | null;
}

// 'left' means the outcome on Instagram is unknown, so the claim stays and a run after the lease decides
type Settled = 'published' | 'retry' | 'failed' | 'left';

// transient marks a failure that may pass on its own, such as a timeout or one of Instagram's temporary codes
class PublishError extends Error {
    readonly transient: boolean;

    constructor(message: string, transient: boolean) {
        super(message);
        this.transient = transient;
    }
}

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/[^\x20-\x7E]/g, '').trim();
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').replace(/[^\x20-\x7E]/g, '').trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    console.error('   Add these as GitHub Actions secrets in your repo settings.');
    process.exit(1);
}

const GRAPH_URL = 'https://graph.instagram.com/v25.0';
const POST_COLUMNS = 'id,account_id,status,scheduled_at,claimed_at,attempts,data';
const REQUEST_TIMEOUT_MS = 15000;
// the workflow stops the job at 14 minutes; Instagram calls stop at 12 so every claimed post still gets its outcome saved
const RUN_DEADLINE = AbortSignal.timeout(12 * 60 * 1000);

// Supabase REST helpers (no SDK, native fetch only)

// Legacy service_role keys are JWTs and go in both headers. New sb_secret_ keys are not JWTs
// and Supabase expects them on apikey only.
const sbHeaders: Record<string, string> = {
    'apikey': SUPABASE_SERVICE_KEY,
    ...(SUPABASE_SERVICE_KEY.startsWith('eyJ') ? { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } : {}),
    'Content-Type': 'application/json',
};

async function sbGet<T>(path: string): Promise<T> {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { headers: sbHeaders, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Supabase GET ${path}: ${await res.text()}`);
    return res.json() as Promise<T>;
}

async function sbPatch<T>(path: string, body: unknown): Promise<T[]> {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
        method: 'PATCH',
        headers: { ...sbHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Supabase PATCH ${path}: ${await res.text()}`);
    return res.json() as Promise<T[]>;
}

// Data access

function toPost(row: ScheduledPostRow): ScheduledPost {
    return {
        id: row.id,
        accountId: row.account_id,
        status: row.status,
        scheduledAt: row.scheduled_at,
        ...(row.data || {}),
        claimedAt: row.claimed_at,
        attempts: row.attempts ?? 0,
    };
}

async function getDuePosts(): Promise<ScheduledPost[]> {
    const now = encodeURIComponent(new Date().toISOString());
    const rows = await sbGet<ScheduledPostRow[]>(`/scheduled_posts?status=eq.pending&scheduled_at=lte.${now}&select=${POST_COLUMNS}`);
    return (rows || []).map(toPost);
}

// posts still publishing under a claim older than the lease belong to a run that died
async function getStalePosts(): Promise<ScheduledPost[]> {
    const cutoff = encodeURIComponent(staleClaimCutoff(Date.now()));
    const rows = await sbGet<ScheduledPostRow[]>(`/scheduled_posts?status=eq.publishing&claimed_at=lt.${cutoff}&select=${POST_COLUMNS}`);
    return (rows || []).map(toPost);
}

async function getAccount(accountId: string): Promise<Account | null> {
    const rows = await sbGet<AccountRow[]>(`/accounts?id=eq.${accountId}&select=id,platform,data`);
    if (!rows || rows.length === 0) return null;
    return { id: rows[0].id, platform: rows[0].platform, ...(rows[0].data || {}) };
}

async function updatePost(id: string, updates: Partial<ScheduledPost>): Promise<void> {
    const { status, ...dataUpdates } = updates;
    const patch: { status?: PostStatus; data?: Partial<ScheduledPost> } = {};
    if (status) patch.status = status;

    if (Object.keys(dataUpdates).length > 0) {
        const rows = await sbGet<Pick<ScheduledPostRow, 'data'>[]>(`/scheduled_posts?id=eq.${id}&select=data`);
        patch.data = { ...(rows?.[0]?.data || {}), ...dataUpdates };
    }

    await sbPatch(`/scheduled_posts?id=eq.${id}&select=id`, patch);
}

// matches only the post as it was listed (pending, or the same expired claim) with the same attempts, as the Worker does
async function claimPost(post: ScheduledPost): Promise<ScheduledPost | null> {
    const attempts = post.attempts ?? 0;
    const unchanged = post.status === 'publishing'
        ? `status=eq.publishing&claimed_at=eq.${encodeURIComponent(post.claimedAt ?? '')}`
        : 'status=eq.pending';
    const rows = await sbPatch<ScheduledPostRow>(
        `/scheduled_posts?id=eq.${post.id}&attempts=eq.${attempts}&${unchanged}&select=${POST_COLUMNS}`,
        { status: 'publishing', claimed_at: new Date().toISOString(), attempts: attempts + 1 },
    );
    return rows[0] ? toPost(rows[0]) : null;
}

// Instagram publishing

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

async function graph(method: 'GET' | 'POST', path: string, params: Record<string, string>): Promise<GraphResponse> {
    const url = `${GRAPH_URL}${path}?${new URLSearchParams(params).toString()}`;
    let res: Response;
    try {
        res = await fetch(url, { method, signal: AbortSignal.any([RUN_DEADLINE, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]) });
    } catch (err) {
        throw new PublishError(`Instagram API unreachable (${(err as Error).name})`, true);
    }
    const data = await res.json().catch(() => ({})) as GraphResponse;
    if (data.error) throw new PublishError(data.error.message, isTransientGraphCode(data.error.code));
    if (!res.ok) throw new PublishError(`Instagram answered with status ${res.status}`, res.status >= 500);
    return data;
}

function containerParams(post: ScheduledPost, token: string): Record<string, string> {
    // URLSearchParams needs strings, so the boolean, number and list values are written out here
    const params: Record<string, string> = { access_token: token };
    const tags = post.userTags?.length ? JSON.stringify(post.userTags) : '';

    if (post.mediaType === 'REELS') {
        params.media_type = 'REELS';
        params.video_url = post.mediaUrl ?? '';
        if (post.caption) params.caption = post.caption;
        if (post.shareToFeed !== undefined) params.share_to_feed = String(post.shareToFeed);
        if (post.coverUrl) params.cover_url = post.coverUrl;
        if (post.collaborators?.length) params.collaborators = JSON.stringify(post.collaborators);
        if (post.audioName) params.audio_name = post.audioName;
        if (post.thumbOffset != null) params.thumb_offset = String(post.thumbOffset);
        if (post.locationId) params.location_id = post.locationId;
        if (tags) params.user_tags = tags;
    } else if (post.mediaType === 'STORIES') {
        params.media_type = 'STORIES';
        if (post.mediaUrl?.match(/\.(mp4|mov|avi|webm)/i)) {
            params.video_url = post.mediaUrl;
        } else {
            params.image_url = post.mediaUrl ?? '';
        }
        if (tags) params.user_tags = tags;
    } else {
        params.image_url = post.mediaUrl ?? '';
        if (post.caption) params.caption = post.caption;
        if (post.locationId) params.location_id = post.locationId;
        if (tags) params.user_tags = tags;
        if (post.altText) params.alt_text = post.altText;
    }
    return params;
}

async function containerStatus(containerId: string, token: string): Promise<GraphResponse> {
    return graph('GET', `/${containerId}`, { fields: 'status_code,status', access_token: token });
}

async function waitForContainer(post: ScheduledPost, containerId: string, token: string): Promise<void> {
    if (post.mediaType !== 'REELS' && post.mediaType !== 'STORIES') {
        await sleep(2000);
        return;
    }
    for (let i = 0; i < 60; i++) {
        await sleep(3000);
        const status = await containerStatus(containerId, token);
        if (status.status_code === 'FINISHED' || status.status_code === 'PUBLISHED') return;
        if (status.status_code === 'ERROR') throw new PublishError('Processing failed: ' + (status.status || ''), false);
        if (status.status_code === 'EXPIRED') throw new PublishError('Container expired', false);
    }
    throw new PublishError('Instagram did not finish processing the media within 3 minutes', false);
}

// a container from an earlier attempt is checked first, so a post that already went out is never published again
async function publishToInstagram(post: ScheduledPost, attempt: Attempt): Promise<string | null> {
    const account = await getAccount(post.accountId);
    if (!account) throw new PublishError('Account not found: ' + post.accountId, false);
    if (account.platform !== 'instagram' || !account.igUserId) throw new PublishError('Scheduled posts can only publish to Instagram accounts', false);
    if (!account.accessToken) throw new PublishError('No Instagram access token stored - reconnect this account', false);
    attempt.account = account;
    const igId = account.igUserId;
    const token = account.accessToken;

    if (attempt.containerId) {
        const status = await containerStatus(attempt.containerId, token);
        const step = containerStep(status.status_code ?? 'IN_PROGRESS');
        if (step === 'published') return null;
        if (step === 'fail') throw new PublishError('Processing failed: ' + (status.status || ''), false);
        if (step === 'recreate') attempt.containerId = null;
    }
    if (!attempt.containerId) {
        const created = await graph('POST', `/${igId}/media`, containerParams(post, token));
        if (!created.id) throw new PublishError('Instagram did not return a container id', true);
        await updatePost(post.id, { containerId: created.id });
        attempt.containerId = created.id;
    }

    await waitForContainer(post, attempt.containerId, token);
    const published = await graph('POST', `/${igId}/media_publish`, { creation_id: attempt.containerId, access_token: token });
    return published.id ?? null;
}

// an error before Instagram could have published needs no check; after that, the container's status decides
async function settleFailure(post: ScheduledPost, attempt: Attempt, err: unknown, transientError: boolean): Promise<Settled> {
    let statusCode: InstagramContainerStatusCode | null = null;
    if (attempt.account?.accessToken && attempt.containerId) {
        try {
            statusCode = (await containerStatus(attempt.containerId, attempt.account.accessToken)).status_code ?? 'IN_PROGRESS';
        } catch {
            console.error('  Left for the next run: the container status could not be read');
            return 'left';
        }
    }
    if (statusCode === 'PUBLISHED') {
        await updatePost(post.id, { status: 'published', publishedAt: new Date().toISOString(), error: null });
        return 'published';
    }

    const attempts = post.attempts ?? 1;
    const transient = transientError || statusCode === 'IN_PROGRESS' || statusCode === 'EXPIRED';
    const reason = (err as Error).message;
    if (failureOutcome(transient, attempts) === 'retry') {
        await updatePost(post.id, { status: 'pending', error: reason, ...(statusCode === 'EXPIRED' && { containerId: null }) });
        console.error(`  Will retry (attempt ${attempts} of ${MAX_PUBLISH_ATTEMPTS}): ${reason}`);
        return 'retry';
    }
    await updatePost(post.id, { status: 'failed', error: failureMessage(reason, transient, attempts) });
    console.error(`  Failed: ${reason}`);
    return 'failed';
}

async function settle(post: ScheduledPost, attempt: Attempt, err: unknown, transient: boolean): Promise<Settled> {
    try {
        return await settleFailure(post, attempt, err, transient);
    } catch (writeErr) {
        // the claim stays, so the next run after the lease finds out what happened from the saved container
        console.error(`  Left for the next run: the outcome could not be saved (${(writeErr as Error).message})`);
        return 'left';
    }
}

async function publishClaimed(post: ScheduledPost): Promise<Settled> {
    const attempt: Attempt = { account: null, containerId: post.containerId ?? null };

    // a post taken over after its last attempt is only checked on Instagram, never started again
    if ((post.attempts ?? 1) > MAX_PUBLISH_ATTEMPTS) {
        attempt.account = await getAccount(post.accountId).catch(() => null);
        return settle(post, attempt, new Error('The publishing run stopped before it finished.'), true);
    }

    try {
        const mediaId = await publishToInstagram(post, attempt);
        await updatePost(post.id, { status: 'published', publishedMediaId: mediaId, publishedAt: new Date().toISOString(), error: null });
        console.log(`  Published: media ${mediaId ?? '(already published by an earlier attempt)'}`);
        return 'published';
    } catch (err) {
        // anything that is not Instagram's answer is the database or the network, which may pass on its own
        return settle(post, attempt, err, err instanceof PublishError ? err.transient : true);
    }
}

// Main

async function main(): Promise<void> {
    console.log('Instagram scheduled post publisher');
    console.log(`   Time: ${new Date().toISOString()}\n`);

    const [stalePosts, duePosts] = await Promise.all([getStalePosts(), getDuePosts()]);
    const candidates = [...stalePosts, ...duePosts];

    if (candidates.length === 0) {
        console.log('No posts due for publishing');
        process.exit(0);
    }

    console.log(`${candidates.length} post(s) due for publishing\n`);
    let processed = 0;

    for (const candidate of candidates) {
        // past the deadline every Instagram call fails, so a new claim would only sit out the lease
        if (RUN_DEADLINE.aborted) break;
        console.log(`  Publishing: ${candidate.id} (${candidate.mediaType}) - scheduled ${candidate.scheduledAt}`);
        let post: ScheduledPost | null;
        try {
            post = await claimPost(candidate);
        } catch (err) {
            console.error(`  Skipped: the claim could not be saved (${(err as Error).message})`);
            continue;
        }
        if (!post) {
            console.log('  Skipped: already claimed by the other scheduler');
            continue;
        }
        if (candidate.status === 'publishing') console.log(`  Taken over: the claim from ${candidate.claimedAt} expired`);
        if (await publishClaimed(post) === 'published') processed++;
    }

    console.log(`\nResults: ${processed}/${candidates.length} published`);
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
