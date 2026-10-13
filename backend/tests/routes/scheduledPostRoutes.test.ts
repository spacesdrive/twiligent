import { test, describe, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import scheduledPostRoutes from '../../routes/scheduledPostRoutes.ts';
import { fakeSupabase, tableRow } from '../fixtures/fakeSupabase.ts';
import type { FakeSupabase } from '../fixtures/fakeSupabase.ts';
import { mountWithContext, callRoute } from '../fixtures/routeHarness.ts';

const FIXED_NOW = Date.parse('2026-09-01T12:00:00Z');

function postRow(id: string, status: string, userId = 'user-1') {
    return tableRow('scheduled_posts', {
        id, user_id: userId, account_id: 'ig1', status, scheduled_at: '2026-09-02T00:00:00.000Z', data: { caption: 'Old', mediaUrl: 'https://cdn/a.jpg' },
    });
}

before(() => mock.timers.enable({ apis: ['Date'], now: FIXED_NOW }));
after(() => mock.timers.reset());
afterEach(() => mock.restoreAll());

function setup(rows = [postRow('pending1', 'pending'), postRow('busy', 'publishing'), postRow('done', 'published'), postRow('theirs', 'pending', 'user-2')]) {
    mock.method(Math, 'random', () => 0.5);
    mock.method(console, 'warn', () => undefined);
    const supabase = fakeSupabase(rows);
    const app = mountWithContext(app => app.route('/', scheduledPostRoutes), { supabase, userId: 'user-1' });
    const call = async (method: string, path: string, json?: unknown) => {
        const response = await callRoute(app, method, path, { json });
        return { status: response.status, body: JSON.parse(response.body) as Record<string, unknown> };
    };
    return { supabase, call };
}

function failure(status: number, code: string, message: string) {
    return { status, body: { success: false, code, message, requestId: 'req-test' } };
}

function storedData(supabase: FakeSupabase, id: string) {
    return supabase.table.find(row => row.id === id)?.data as Record<string, unknown>;
}

describe('scheduled post routes', () => {
    test('creating a post needs an account, media and a future time', async () => {
        const { call } = setup();
        const required = failure(400, 'VALIDATION_ERROR', 'accountId, mediaUrl, and scheduledAt are required');
        assert.deepEqual(await call('POST', '/scheduled-posts', { accountId: 'ig1', mediaUrl: 'https://cdn/b.jpg' }), required);
        assert.deepEqual(await call('POST', '/scheduled-posts', { accountId: 'ig1', mediaUrl: 'https://cdn/b.jpg', scheduledAt: '2026-08-01T00:00:00Z' }),
            failure(400, 'VALIDATION_ERROR', 'scheduledAt must be a valid future date'));
        assert.deepEqual(await call('POST', '/scheduled-posts', { accountId: 'ig1', mediaUrl: 'https://cdn/b.jpg', scheduledAt: '2026-09-03T00:00:00Z', mediaType: 'GIF' }),
            failure(400, 'VALIDATION_ERROR', 'mediaType must be one of IMAGE, VIDEO, REELS, STORIES, CAROUSEL'));
    });

    test('a created post gets its defaults and is stored for the user', async () => {
        const { supabase, call } = setup([]);
        const created = await call('POST', '/scheduled-posts', { accountId: 'ig1', mediaUrl: ' https://cdn/b.jpg ', scheduledAt: '2026-09-03T08:00:00+02:00', caption: 'Hi' });
        assert.equal(created.status, 200);
        assert.deepEqual(created.body.post, {
            id: (created.body.post as { id: string }).id,
            accountId: 'ig1', platform: 'instagram', mediaType: 'IMAGE', mediaUrl: 'https://cdn/b.jpg', caption: 'Hi', coverUrl: null,
            shareToFeed: true, collaborators: [], audioName: '', thumbOffset: null, locationId: '', userTags: [], altText: '',
            scheduledAt: '2026-09-03T06:00:00.000Z', status: 'pending', createdAt: '2026-09-01T12:00:00.000Z', publishedMediaId: null, error: null,
        });
        assert.equal(supabase.table[0].user_id, 'user-1');
    });

    test('only pending posts of the user can be edited, and only the editable fields change', async () => {
        const { supabase, call } = setup();
        const edited = await call('PUT', '/scheduled-posts/pending1', { caption: 'New', mediaUrl: 'https://evil/x.jpg', coverUrl: null });
        assert.equal(edited.status, 200);
        assert.deepEqual(storedData(supabase, 'pending1'), { caption: 'New', mediaUrl: 'https://cdn/a.jpg', coverUrl: null });
        assert.deepEqual(await call('PUT', '/scheduled-posts/done', { caption: 'x' }), failure(400, 'VALIDATION_ERROR', 'Can only edit pending posts'));
        assert.deepEqual(await call('PUT', '/scheduled-posts/theirs', { caption: 'x' }), failure(404, 'NOT_FOUND', 'Scheduled post not found'));
        assert.deepEqual(await call('PUT', '/scheduled-posts/pending1', { scheduledAt: 'soon' }), failure(400, 'VALIDATION_ERROR', 'scheduledAt must be a valid date'));
    });

    test('a post being published cannot be deleted, and delete all keeps it', async () => {
        const { supabase, call } = setup();
        assert.deepEqual(await call('DELETE', '/scheduled-posts/busy'), failure(400, 'VALIDATION_ERROR', 'Cannot delete a post that is currently publishing'));
        assert.deepEqual(await call('DELETE', '/scheduled-posts/pending1'), { status: 200, body: { success: true, message: 'Scheduled post deleted' } });
        const all = await call('DELETE', '/scheduled-posts');
        assert.equal(all.status, 200);
        assert.deepEqual(supabase.table.map(row => row.id).sort(), ['busy', 'theirs']);
    });
});
