import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createScheduledPostRepository } from '../../repositories/scheduledPostRepository.ts';
import { fakeSupabase, tableRow } from '../fixtures/fakeSupabase.ts';
import type { Row } from '../fixtures/fakeSupabase.ts';

function postRow(id: string, overrides: Row = {}): Row {
    return tableRow('scheduled_posts', {
        id, user_id: 'user-1', account_id: 'ig1', status: 'pending', scheduled_at: '2026-09-01T11:00:00.000Z',
        claimed_at: null, attempts: 0, data: { caption: 'Hi' }, ...overrides,
    });
}

const EXPIRED_CLAIM = '2026-09-01T11:30:00.000Z';

describe('scheduled post repository', () => {
    test('two schedulers claiming the same listed post: only the first gets it, and the claim counts an attempt', async () => {
        const posts = createScheduledPostRepository(fakeSupabase([postRow('p1')]));
        const [listed] = await posts.listDue();

        const first = await posts.claim(listed);
        assert.equal(first?.status, 'publishing');
        assert.equal(first?.attempts, 1);
        assert.ok(first?.claimedAt);
        assert.equal(await posts.claim(listed), null);
    });

    test('only claims older than the cutoff are stale, and a takeover must match the expired claim it saw', async () => {
        const posts = createScheduledPostRepository(fakeSupabase([
            postRow('old', { status: 'publishing', claimed_at: EXPIRED_CLAIM, attempts: 1 }),
            postRow('live', { status: 'publishing', claimed_at: '2026-09-01T11:55:00.000Z', attempts: 1 }),
        ]));
        const stale = await posts.listStale('2026-09-01T11:40:00.000Z');
        assert.deepEqual(stale.map(post => post.id), ['old']);

        assert.equal((await posts.claim(stale[0]))?.attempts, 2);
        assert.equal(await posts.claim(stale[0]), null);
    });

    test('a post being published is not deleted, while a pending one is', async () => {
        const db = fakeSupabase([postRow('busy', { status: 'publishing', claimed_at: EXPIRED_CLAIM }), postRow('free')]);
        const posts = createScheduledPostRepository(db);

        assert.equal(await posts.deleteForUser('busy', 'user-1'), false);
        assert.equal(await posts.deleteForUser('free', 'user-1'), true);
        assert.deepEqual(db.table.map(row => row.id), ['busy']);
    });

    test('an edit only lands while the post is still pending', async () => {
        const db = fakeSupabase([postRow('claimed', { status: 'publishing', claimed_at: EXPIRED_CLAIM }), postRow('free')]);
        const posts = createScheduledPostRepository(db);

        assert.equal(await posts.updatePendingForUser('claimed', { caption: 'Changed' }, 'user-1'), false);
        assert.equal(await posts.updatePendingForUser('free', { caption: 'Changed' }, 'user-1'), true);
        assert.deepEqual(db.table.map(row => (row.data as Row).caption), ['Hi', 'Changed']);
    });
});

test('only published posts with an automation, no rule yet and no recorded failure wait for a rule, each with its owner', async () => {
    const automation = { replyText: 'Here is the link', publicReplyTexts: [] };
    const posts = createScheduledPostRepository(fakeSupabase([
        postRow('waiting', { status: 'published', user_id: 'user-2', data: { automation, publishedMediaId: '1789' } }),
        postRow('pending', { data: { automation } }),
        postRow('plain', { status: 'published', data: { caption: 'No automation' } }),
        postRow('done', { status: 'published', data: { automation, automationRuleId: 'rule-1' } }),
        postRow('broken', { status: 'published', data: { automation, automationError: 'No access token' } }),
    ]));
    const waiting = await posts.listAwaitingAutomation(10);
    assert.deepEqual(waiting.map(item => [item.post.id, item.userId, item.post.publishedMediaId]), [['waiting', 'user-2', '1789']]);
});
