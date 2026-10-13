#!/usr/bin/env node
// Instagram scheduled post publisher, run by GitHub Actions every 15 minutes with no npm install.
// Node 22.18+ runs this file directly by stripping its types; it needs SUPABASE_URL and
// SUPABASE_SERVICE_KEY (a sb_secret_ key or the legacy service_role key) as GitHub secrets.

import type { Account, Platform, PostStatus, ScheduledPost } from '../shared/types/domain.ts';

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
    data: Partial<ScheduledPost> | null;
}

interface GraphResponse {
    id?: string;
    error?: { message: string };
    status_code?: string;
    status?: string;
}

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/[^\x20-\x7E]/g, '').trim();
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').replace(/[^\x20-\x7E]/g, '').trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    console.error('   Add these as GitHub Actions secrets in your repo settings.');
    process.exit(1);
}

// Supabase REST helpers (no SDK, native fetch only)

// Legacy service_role keys are JWTs and go in both headers. New sb_secret_ keys are not JWTs
// and Supabase expects them on apikey only.
const sbHeaders: Record<string, string> = {
    'apikey': SUPABASE_SERVICE_KEY,
    ...(SUPABASE_SERVICE_KEY.startsWith('eyJ') ? { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } : {}),
    'Content-Type': 'application/json',
};

async function sbGet<T>(path: string): Promise<T> {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { headers: sbHeaders });
    if (!res.ok) throw new Error(`Supabase GET ${path}: ${await res.text()}`);
    return res.json() as Promise<T>;
}

async function sbPatch(path: string, body: unknown): Promise<void> {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
        method: 'PATCH',
        headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase PATCH ${path}: ${await res.text()}`);
}

// Data access

async function getDuePosts(): Promise<ScheduledPost[]> {
    const now = encodeURIComponent(new Date().toISOString());
    const rows = await sbGet<ScheduledPostRow[]>(
        `/scheduled_posts?status=eq.pending&scheduled_at=lte.${now}&select=id,account_id,status,scheduled_at,data`
    );
    return (rows || []).map(row => ({
        id: row.id,
        accountId: row.account_id,
        status: row.status,
        scheduledAt: row.scheduled_at,
        ...(row.data || {}),
    }));
}

async function getAccount(accountId: string): Promise<Account | null> {
    const rows = await sbGet<AccountRow[]>(`/accounts?id=eq.${accountId}&select=id,platform,data`);
    if (!rows || rows.length === 0) return null;
    return { id: rows[0].id, platform: rows[0].platform, ...(rows[0].data || {}) };
}

async function updatePostStatus(id: string, updates: Partial<ScheduledPost>): Promise<void> {
    const { status, ...dataUpdates } = updates;
    const patch: { status?: PostStatus; data?: Partial<ScheduledPost> } = {};
    if (status) patch.status = status;

    if (Object.keys(dataUpdates).length > 0) {
        const rows = await sbGet<Pick<ScheduledPostRow, 'data'>[]>(`/scheduled_posts?id=eq.${id}&select=data`);
        const currentData = rows?.[0]?.data || {};
        patch.data = { ...currentData, ...dataUpdates };
    }

    await sbPatch(`/scheduled_posts?id=eq.${id}`, patch);
}

// Moves a post from pending to publishing only if it is still pending, so this workflow and the
// Worker cron never publish the same post twice. Returns false when the other one claimed it.
async function claimPost(id: string): Promise<boolean> {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/scheduled_posts?id=eq.${id}&status=eq.pending`, {
        method: 'PATCH',
        headers: { ...sbHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify({ status: 'publishing' }),
    });
    if (!res.ok) throw new Error(`Supabase PATCH claim ${id}: ${await res.text()}`);
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
}

// Instagram publishing

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

async function publishToInstagram(post: ScheduledPost, account: Account): Promise<string | undefined> {
    if (account.platform !== 'instagram' || !account.igUserId) throw new Error('Scheduled posts can only publish to Instagram accounts');
    if (!account.accessToken) throw new Error('No Instagram access token stored - reconnect this account');
    const igId = account.igUserId;
    const token = account.accessToken;
    // URLSearchParams stringifies the boolean and number values
    const params: Record<string, string | number | boolean | undefined> = { access_token: token };

    if (post.mediaType === 'REELS') {
        params.media_type = 'REELS';
        params.video_url = post.mediaUrl;
        if (post.caption) params.caption = post.caption;
        if (post.shareToFeed !== undefined) params.share_to_feed = post.shareToFeed;
        if (post.coverUrl) params.cover_url = post.coverUrl;
        if (post.collaborators?.length) params.collaborators = JSON.stringify(post.collaborators);
        if (post.audioName) params.audio_name = post.audioName;
        if (post.thumbOffset != null) params.thumb_offset = post.thumbOffset;
        if (post.locationId) params.location_id = post.locationId;
        if (post.userTags?.length) params.user_tags = JSON.stringify(post.userTags);
    } else if (post.mediaType === 'STORIES') {
        params.media_type = 'STORIES';
        if (post.mediaUrl!.match(/\.(mp4|mov|avi|webm)/i)) {
            params.video_url = post.mediaUrl;
        } else {
            params.image_url = post.mediaUrl;
        }
        if (post.userTags?.length) params.user_tags = JSON.stringify(post.userTags);
    } else {
        params.image_url = post.mediaUrl;
        if (post.caption) params.caption = post.caption;
        if (post.locationId) params.location_id = post.locationId;
        if (post.userTags?.length) params.user_tags = JSON.stringify(post.userTags);
        if (post.altText) params.alt_text = post.altText;
    }

    const qs = new URLSearchParams(params as Record<string, string>).toString();
    const createRes = await fetch(`https://graph.instagram.com/v25.0/${igId}/media?${qs}`, { method: 'POST' });
    const createData = await createRes.json() as GraphResponse;
    if (createData.error) throw new Error(createData.error.message);

    const containerId = createData.id;

    if (post.mediaType === 'REELS' || post.mediaType === 'STORIES') {
        let finished = false;
        for (let i = 0; i < 60 && !finished; i++) {
            await sleep(3000);
            const statusRes = await fetch(
                `https://graph.instagram.com/v25.0/${containerId}?fields=status_code,status&access_token=${token}`
            );
            const statusData = await statusRes.json() as GraphResponse;
            finished = statusData.status_code === 'FINISHED' || statusData.status_code === 'PUBLISHED';
            if (statusData.status_code === 'ERROR') throw new Error('Processing failed: ' + (statusData.status || ''));
            if (statusData.status_code === 'EXPIRED') throw new Error('Container expired');
        }
        if (!finished) throw new Error('Instagram did not finish processing the media within 3 minutes');
    } else {
        await sleep(2000);
    }

    const pubRes = await fetch(
        `https://graph.instagram.com/v25.0/${igId}/media_publish?creation_id=${containerId}&access_token=${token}`,
        { method: 'POST' }
    );
    const pubData = await pubRes.json() as GraphResponse;
    if (pubData.error) throw new Error(pubData.error.message);

    return pubData.id;
}

// Main

async function main(): Promise<void> {
    console.log('Instagram scheduled post publisher');
    console.log(`   Time: ${new Date().toISOString()}\n`);

    const duePosts = await getDuePosts();

    if (duePosts.length === 0) {
        console.log('No posts due for publishing');
        process.exit(0);
    }

    console.log(`${duePosts.length} post(s) due for publishing\n`);
    let processed = 0;

    for (const post of duePosts) {
        console.log(`  Publishing: ${post.id} (${post.mediaType}) - scheduled ${post.scheduledAt}`);
        if (!(await claimPost(post.id))) {
            console.log('  Skipped: already claimed by the other scheduler');
            continue;
        }

        try {
            const account = await getAccount(post.accountId);
            if (!account) throw new Error('Account not found: ' + post.accountId);

            const mediaId = await publishToInstagram(post, account);
            await updatePostStatus(post.id, {
                status: 'published',
                publishedMediaId: mediaId,
                publishedAt: new Date().toISOString(),
            });
            processed++;
            console.log(`  Published: media ${mediaId}`);
        } catch (err) {
            await updatePostStatus(post.id, { status: 'failed', error: (err as Error).message });
            console.error(`  Failed: ${(err as Error).message}`);
        }
    }

    console.log(`\nResults: ${processed}/${duePosts.length} published`);
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
