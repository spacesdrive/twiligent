// fetch is a global in Cloudflare Workers.
import { getDuePosts, updatePost, getAccountById, claimPost } from '../lib/db.ts';
import { buildMediaParams } from '../services/instagram.ts';
import type { InstagramMediaParams } from '../services/instagramPublishing.ts';
import type { InstagramApiContainerStatus, InstagramApiIdResponse } from '../services/instagramApi.ts';
import type { ScheduledPost, ScheduledPublishFailure, ScheduledPublishRun } from '../../shared/types/domain.ts';
import type { InstagramPublishMediaType } from '../../shared/types/instagram.ts';
import type { SupabaseClient } from '../types/app.ts';

const GRAPH_API = 'https://graph.instagram.com/v25.0';

export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function wait(ms: number): Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function createContainer(igId: string, params: InstagramMediaParams): Promise<string> {
    // URLSearchParams stringifies the boolean and number values
    const query = new URLSearchParams(params as unknown as Record<string, string>).toString();
    const createRes = await fetch(`${GRAPH_API}/${igId}/media?${query}`, { method: 'POST' });
    const createData = await createRes.json() as InstagramApiIdResponse;
    if (createData.error) throw new Error(createData.error.message);
    return createData.id;
}

// reels and stories need processing; other media only need a short pause
async function waitForContainer(mediaType: InstagramPublishMediaType | undefined, containerId: string, token: string): Promise<void> {
    if (mediaType !== 'REELS' && mediaType !== 'STORIES') {
        await wait(2000);
        return;
    }
    for (let i = 0; i < 60; i++) {
        await wait(3000);
        const statusRes = await fetch(`${GRAPH_API}/${containerId}?fields=status_code,status&access_token=${token}`);
        const statusData = await statusRes.json() as InstagramApiContainerStatus;
        if (statusData.status_code === 'FINISHED' || statusData.status_code === 'PUBLISHED') return;
        if (statusData.status_code === 'ERROR') throw new Error('Processing failed: ' + (statusData.status || ''));
        if (statusData.status_code === 'EXPIRED') throw new Error('Container expired');
    }
}

async function publishContainer(igId: string, containerId: string, token: string): Promise<string> {
    const pubRes = await fetch(
        `${GRAPH_API}/${igId}/media_publish?creation_id=${containerId}&access_token=${token}`,
        { method: 'POST' }
    );
    const pubData = await pubRes.json() as InstagramApiIdResponse;
    if (pubData.error) throw new Error(pubData.error.message);
    return pubData.id;
}

async function publishPost(supabase: SupabaseClient, post: ScheduledPost): Promise<string> {
    const acct = await getAccountById(supabase, post.accountId);
    if (!acct) throw new Error('Account not found: ' + post.accountId);

    const igId = acct.igUserId!;
    const token = acct.accessToken!;
    const params = buildMediaParams(post, token);

    const containerId = await createContainer(igId, params);
    await waitForContainer(post.mediaType, containerId, token);
    return publishContainer(igId, containerId, token);
}

// cron entry: there is no request context, so supabase is passed in directly
export async function processScheduledPosts(supabase: SupabaseClient): Promise<ScheduledPublishRun> {
    let processed = 0;
    const errors: ScheduledPublishFailure[] = [];

    try {
        const duePosts = await getDuePosts(supabase);

        for (const post of duePosts) {
            if (!(await claimPost(supabase, post.id))) continue;

            try {
                const mediaId = await publishPost(supabase, post);
                await updatePost(supabase, post.id, {
                    status: 'published',
                    publishedMediaId: mediaId,
                    publishedAt: new Date().toISOString(),
                });
                processed++;
                console.log(`Published scheduled post ${post.id} → media ${mediaId}`);
            } catch (err) {
                await updatePost(supabase, post.id, { status: 'failed', error: (err as Error).message });
                errors.push({ id: post.id, error: (err as Error).message });
                console.error(`Failed to publish scheduled post ${post.id}: ${(err as Error).message}`);
            }
        }
    } catch (err) {
        console.error('Scheduler error:', err);
    }

    return { processed, errors };
}
