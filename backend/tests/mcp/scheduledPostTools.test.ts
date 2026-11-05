import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cancelScheduledPost, getScheduledPost, listScheduledPosts, scheduleInstagramPost, updateScheduledPost } from '../../mcp/tools/scheduledPostTools.ts';
import { NotFoundError, ValidationError } from '../../lib/errors.ts';
import type { Services } from '../../container.ts';
import type { ToolContext } from '../../mcp/tool.ts';
import type { ScheduledPostService } from '../../services/scheduledPostService.ts';
import type { ScheduledPost } from '../../../shared/types/domain.ts';

const LATER = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

function post(id: string, status: ScheduledPost['status'] = 'pending', extra: Partial<ScheduledPost> = {}): ScheduledPost {
    return { id, accountId: 'ig-1', status, scheduledAt: LATER, mediaUrl: `https://res.cloudinary.com/demo/${id}.jpg`, caption: 'Hello', containerId: 'secret-container', ...extra };
}

function context(posts: ScheduledPost[]): ToolContext & { created: ScheduledPost[]; removed: string[] } {
    const created: ScheduledPost[] = [];
    const removed: string[] = [];
    const scheduledPosts: Pick<ScheduledPostService, 'list' | 'create' | 'update' | 'remove'> = {
        list: async userId => (userId === 'user-1' ? [...posts, ...created] : []),
        async create(_userId, request) {
            const made = { ...post(`new-${created.length}`), ...request, status: 'pending' as const };
            created.push(made);
            return made;
        },
        update: async (_userId, postId, changes) => ({ ...post(postId), ...changes }),
        async remove(_userId, postId) {
            removed.push(postId);
        },
    };
    return { services: { scheduledPosts } as unknown as Services, principal: { userId: 'user-1', permission: 'write', via: 'token:t1' }, created, removed };
}

test('listing filters by status, pages with a cursor and leaves claim and container bookkeeping out', async () => {
    const ctx = context([post('a'), post('b', 'failed', { error: 'Media expired' }), post('c')]);
    const first = await listScheduledPosts.run(listScheduledPosts.parse({ status: 'pending', limit: 1 }), ctx) as { posts: { id: string }[]; nextCursor: string; total: number };
    assert.deepEqual(first.posts.map(item => item.id), ['a']);
    assert.equal(first.total, 2);
    const second = await listScheduledPosts.run(listScheduledPosts.parse({ status: 'pending', cursor: first.nextCursor }), ctx) as { posts: { id: string }[]; nextCursor: null };
    assert.deepEqual(second.posts.map(item => item.id), ['c']);
    assert.equal(second.nextCursor, null);
    assert.ok(!JSON.stringify(first).includes('secret-container'));
    assert.throws(() => listScheduledPosts.parse({ status: 'gone' }), ValidationError);
    assert.throws(() => listScheduledPosts.parse({ limit: 500 }), ValidationError);
});

test('getting a post another person owns is not found', async () => {
    const ctx = context([post('a')]);
    await assert.rejects(getScheduledPost.run({ postId: 'a' }, { ...ctx, principal: { ...ctx.principal, userId: 'user-2' } }), NotFoundError);
});

test('scheduling always asks for confirmation, refuses carousels, and returns the existing post for the same media and time', async () => {
    const existing = post('a');
    const ctx = context([existing]);
    const input = scheduleInstagramPost.parse({ accountId: 'ig-1', mediaUrl: existing.mediaUrl, scheduledAt: LATER, caption: 'Hello' });
    assert.equal(scheduleInstagramPost.needsConfirmation?.(input), true);
    assert.match(scheduleInstagramPost.describe?.(input) ?? '', /Instagram account ig-1/);
    const again = await scheduleInstagramPost.run(input, ctx) as { alreadyScheduled: boolean; post: { id: string } };
    assert.equal(again.alreadyScheduled, true);
    assert.equal(again.post.id, 'a');
    assert.equal(ctx.created.length, 0);
    const fresh = await scheduleInstagramPost.run(scheduleInstagramPost.parse({ accountId: 'ig-1', mediaUrl: 'https://res.cloudinary.com/demo/other.jpg', scheduledAt: LATER }), ctx) as { alreadyScheduled: boolean };
    assert.equal(fresh.alreadyScheduled, false);
    assert.equal(ctx.created.length, 1);
    assert.throws(() => scheduleInstagramPost.parse({ accountId: 'ig-1', mediaUrl: 'https://x/y.jpg', scheduledAt: LATER, mediaType: 'CAROUSEL' }), ValidationError);
});

test('an update needs at least one field, and cancelling needs confirmation', async () => {
    assert.throws(() => updateScheduledPost.parse({ postId: 'a' }), ValidationError);
    assert.deepEqual(updateScheduledPost.parse({ postId: 'a', caption: 'New' }), { postId: 'a', changes: { caption: 'New' } });
    const ctx = context([post('a')]);
    assert.equal(cancelScheduledPost.needsConfirmation?.({ postId: 'a' }), true);
    await cancelScheduledPost.run({ postId: 'a' }, ctx);
    assert.deepEqual(ctx.removed, ['a']);
});

test('changing a queued post asks for a confirmation that shows every changed field in full', () => {
    const input = updateScheduledPost.parse({ postId: 'a', caption: 'A long caption '.repeat(20), collaborators: ['friend'] });
    assert.equal(updateScheduledPost.needsConfirmation?.(input), true);
    const text = updateScheduledPost.describe?.(input) ?? '';
    assert.match(text, /Change scheduled post a\./);
    assert.ok(text.includes('A long caption '.repeat(20).trim()));
    assert.match(text, /Collaborators: friend\./);
});

test('fields the tools do not publish are refused, so a client cannot set what it was never shown', () => {
    assert.throws(() => updateScheduledPost.parse({ postId: 'a', coverUrl: 'https://cdn.example/x.jpg' }), /cannot be set from Claude: coverUrl/);
    assert.throws(() => scheduleInstagramPost.parse({ accountId: 'ig-1', mediaUrl: 'https://cdn.example/a.jpg', scheduledAt: LATER, userTags: [] }), /userTags/);
    const withMedia = scheduleInstagramPost.parse({ accountId: 'ig-1', mediaUrl: 'https://cdn.example/a.jpg', scheduledAt: LATER, confirmationToken: 'x' });
    assert.match(scheduleInstagramPost.describe?.(withMedia) ?? '', /Media: https:\/\/cdn\.example\/a\.jpg\./);
});
