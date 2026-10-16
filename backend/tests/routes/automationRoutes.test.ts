import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import automationRouter from '../../routes/automationRoutes.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FetchMock, RecordedRequest } from '../fixtures/fakeFetch.ts';
import { accountRow, fakeSupabase, tableRow } from '../fixtures/fakeSupabase.ts';
import type { FakeSupabase, Row } from '../fixtures/fakeSupabase.ts';
import { backgroundWork, callRoute, mountWithContext } from '../fixtures/routeHarness.ts';
import { mockRowIds } from '../fixtures/rowIds.ts';
import type { Env } from '../../types/env.ts';

const ENV: Partial<Env> = { INSTAGRAM_APP_SECRET: 'IGSECRET', INSTAGRAM_WEBHOOK_VERIFY_TOKEN: 'tok' };
const FUTURE = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 1000).toISOString();

function ruleRow(id: string, userId: string, accountId: string, extra: Row = {}): Row {
    return tableRow('automation_rules', {
        id, user_id: userId, account_id: accountId, name: id, keywords: ['GUIDE'], match_mode: 'contains', case_sensitive: false, media_ids: [],
        reply_text: 'Here it is', link_url: null, enabled: false, hourly_limit: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', ...extra,
    });
}

function commentRow(id: string, userId: string, status: string, extra: Row = {}): Row {
    return tableRow('automation_comments', {
        id, user_id: userId, account_id: userId === 'user-1' ? 'ig1' : 'ig-theirs', rule_id: null, comment_id: `c-${id}`, media_id: '1',
        from_username: 'fan', text: 'GUIDE', status, status_reason: null, error_message: 'x', attempts: 1, next_attempt_at: null, accepted_at: null,
        expires_at: FUTURE, created_at: '2026-10-15T00:00:00Z', ...extra,
    });
}

function seed(): Row[] {
    return [
        tableRow('accounts', accountRow({ id: 'ig1', platform: 'instagram', igUserId: '1784', username: 'mine', accessToken: 'TOKEN-1' })),
        tableRow('accounts', accountRow({ id: 'yt1', platform: 'youtube', channelId: 'UC1' })),
        tableRow('accounts', accountRow({ id: 'ig-theirs', platform: 'instagram', igUserId: '2000', username: 'theirs', accessToken: 'THEIRS' }, 'user-2')),
        ruleRow('rule-mine', 'user-1', 'ig1'),
        ruleRow('rule-theirs', 'user-2', 'ig-theirs'),
        commentRow('failed-mine', 'user-1', 'failed'),
        commentRow('accepted-mine', 'user-1', 'accepted'),
        commentRow('expired-mine', 'user-1', 'failed', { expires_at: PAST }),
        commentRow('failed-theirs', 'user-2', 'failed'),
    ];
}

let fetchMock: FetchMock | null = null;
let graph: RecordedRequest[] = [];
let subscribeAnswer: () => ReturnType<typeof reply> = () => reply({ success: true });

beforeEach(() => {
    graph = [];
    subscribeAnswer = () => reply({ success: true });
    mockRowIds();
    mock.method(console, 'log', () => {});
    mock.method(console, 'warn', () => {});
    mock.method(console, 'error', () => {});
    fetchMock = installFetch(request => {
        graph.push(request);
        return request.url.includes('/subscribed_apps') ? subscribeAnswer() : reply({ message_id: 'm' });
    });
});
afterEach(() => {
    fetchMock?.restore();
    mock.restoreAll();
});

function server(supabase: FakeSupabase = fakeSupabase(seed(), {
    automation_stats: args => ({ comments: { accepted: 1, failed: args.p_account_id ? 0 : 2 }, attempts: { accepted: 1 } }),
    claim_automation_comments: () => [],
})) {
    return { supabase, app: mountWithContext(app => app.route('/', automationRouter), { supabase, userId: 'user-1' }) };
}

async function call(target: ReturnType<typeof server>, method: string, path: string, json?: unknown) {
    const work = backgroundWork();
    const result = await callRoute(target.app, method, path, { json, env: ENV, executionCtx: work });
    await work.settle();
    return { status: result.status, body: JSON.parse(result.body) };
}

const audits = (supabase: FakeSupabase) => supabase.table.filter(row => row._table === 'audit_events').map(row => row.action);

describe('automation routes', () => {
    test('the overview lists only this user\'s rules and Instagram accounts, and whether the webhook can work', async () => {
        const { body } = await call(server(), 'GET', '/automations');
        assert.deepEqual(body.rules.map((rule: { id: string }) => rule.id), ['rule-mine']);
        assert.deepEqual(body.accounts, [{
            accountId: 'ig1', username: 'mine', profilePictureUrl: '', paused: false, cooldownUntil: null, cooldownReason: null, subscribedAt: null,
        }]);
        assert.deepEqual(body.settings, { webhookConfigured: true, paused: false, limits: { accountHourly: 200, userHourly: 500, globalHourly: 1000, recipientDaily: 3 } });
    });

    test('creating an enabled rule saves it, asks Instagram for the account\'s comments and records both', async () => {
        const target = server();
        const { status, body } = await call(target, 'POST', '/automations/rules', {
            accountId: 'ig1', name: 'Guide', keywords: ['GUIDE'], replyText: 'Here it is', linkUrl: 'https://example.com/g', enabled: true,
        });
        assert.equal(status, 200);
        assert.equal(body.rule.enabled, true);
        assert.equal(body.rule.accountId, 'ig1');
        assert.equal(new URL(graph[0].url).pathname, '/v25.0/1784/subscribed_apps');
        assert.equal(new URL(graph[0].url).searchParams.get('subscribed_fields'), 'comments');
        assert.ok(target.supabase.table.some(row => row._table === 'automation_accounts' && row.subscribed_at));
        assert.deepEqual(audits(target.supabase), ['automation_rule.created', 'automation_account.subscribed']);
    });

    test('a rule is still saved when Instagram refuses the subscription, and the account shows as not receiving comments', async () => {
        subscribeAnswer = () => reply({ error: { message: 'Application does not have permission', code: 10 } }, 403);
        const target = server();
        const { status } = await call(target, 'POST', '/automations/rules', { accountId: 'ig1', name: 'G', keywords: ['G'], replyText: 'x', enabled: true });
        assert.equal(status, 200);
        assert.equal((await call(target, 'GET', '/automations')).body.accounts[0].subscribedAt, null);
    });

    test('a rule can only use the user\'s own Instagram account', async () => {
        const target = server();
        for (const accountId of ['ig-theirs', 'yt1', 'missing']) {
            const { status, body } = await call(target, 'POST', '/automations/rules', { accountId, name: 'G', keywords: ['G'], replyText: 'x' });
            assert.equal(status, 404);
            assert.equal(body.message, 'Instagram account not found');
        }
    });

    test('a reply and link over Instagram\'s 1,000 bytes is refused with the size', async () => {
        const { status, body } = await call(server(), 'POST', '/automations/rules', {
            accountId: 'ig1', name: 'G', keywords: ['G'], replyText: 'é'.repeat(500), linkUrl: 'https://example.com/guide',
        });
        assert.equal(status, 400);
        assert.match(body.message, /is 1027 bytes; Instagram accepts at most 1000/);
    });

    test('editing, copying and deleting work on the user\'s rules and answer 404 for anyone else\'s', async () => {
        const target = server();
        assert.equal((await call(target, 'PUT', '/automations/rules/rule-mine', { name: 'Renamed' })).body.rule.name, 'Renamed');
        const copy = (await call(target, 'POST', '/automations/rules/rule-mine/duplicate')).body.rule;
        assert.deepEqual([copy.name, copy.enabled, copy.accountId], ['Renamed (copy)', false, 'ig1']);
        assert.equal((await call(target, 'DELETE', '/automations/rules/rule-mine')).status, 200);
        for (const [method, path] of [['PUT', '/automations/rules/rule-theirs'], ['POST', '/automations/rules/rule-theirs/duplicate'], ['DELETE', '/automations/rules/rule-theirs']] as const) {
            const { status } = await call(target, method, path, method === 'PUT' ? { name: 'x' } : undefined);
            assert.equal(status, 404, `${method} ${path}`);
        }
        assert.ok(target.supabase.table.some(row => row.id === 'rule-theirs'));
        assert.deepEqual(audits(target.supabase), ['automation_rule.updated', 'automation_rule.duplicated', 'automation_rule.deleted']);
    });

    test('testing a rule draft shows whether a sample comment matches and the exact reply, and sends nothing', async () => {
        const { body } = await call(server(), 'POST', '/automations/test', { keywords: ['GUIDE'], replyText: 'Hi', linkUrl: 'https://e.com', comment: 'the guide please' });
        assert.deepEqual(body, { success: true, matched: true, keyword: 'GUIDE', message: 'Hi\n\nhttps://e.com', messageBytes: 17, maxMessageBytes: 1000 });
        const scoped = await call(server(), 'POST', '/automations/test', { keywords: ['GUIDE'], replyText: 'Hi', mediaIds: ['1'], mediaId: '2', comment: 'GUIDE' });
        assert.equal(scoped.body.matched, false);
        assert.equal(graph.length, 0);
    });

    test('activity lists only the user\'s comments, newest page first', async () => {
        const { body } = await call(server(), 'GET', '/automations/activity?status=failed,needs_review&limit=1');
        assert.deepEqual(body.items.map((item: { id: string }) => item.id), ['failed-mine']);
        assert.equal(body.nextBefore, '2026-10-15T00:00:00Z');
    });

    test('a failed reply can be retried once inside its 7 days; sent, expired and other users\' items cannot', async () => {
        const target = server();
        const retried = await call(target, 'POST', '/automations/activity/failed-mine/retry');
        assert.equal(retried.status, 200);
        assert.deepEqual([retried.body.item.status, retried.body.item.errorMessage], ['queued', null]);
        assert.equal((await call(target, 'POST', '/automations/activity/failed-mine/retry')).status, 409);
        assert.equal((await call(target, 'POST', '/automations/activity/accepted-mine/retry')).status, 409);
        assert.equal((await call(target, 'POST', '/automations/activity/expired-mine/retry')).status, 409);
        assert.equal((await call(target, 'POST', '/automations/activity/failed-theirs/retry')).status, 404);
        assert.equal(target.supabase.table.find(row => row.id === 'failed-theirs')!.status, 'failed');
        assert.ok(target.supabase.calls.some(call => call.type === 'rpc' && call.table === 'claim_automation_comments'));
    });

    test('stats default to the last 7 days and pass the filters on', async () => {
        const target = server();
        const { body } = await call(target, 'GET', '/automations/stats?accountId=ig1');
        assert.deepEqual(body.stats, { comments: { accepted: 1, failed: 0 }, attempts: { accepted: 1 } });
        assert.equal(Date.parse(body.to) - Date.parse(body.from), 7 * 24 * 60 * 60 * 1000);
        const sent = target.supabase.calls.find(call => call.table === 'automation_stats')!.values as Row;
        assert.deepEqual([sent.p_user_id, sent.p_account_id, sent.p_rule_id], ['user-1', 'ig1', null]);
        assert.equal((await call(target, 'GET', '/automations/stats?from=2026-10-10&to=2026-10-01')).status, 400);
    });

    test('pausing and resuming an account is recorded, and resuming releases its held replies; other accounts answer 404', async () => {
        const target = server();
        assert.equal((await call(target, 'PUT', '/automations/accounts/ig1', { paused: true })).body.account.paused, true);
        assert.equal((await call(target, 'PUT', '/automations/accounts/ig1', { paused: false })).body.account.paused, false);
        assert.ok(target.supabase.calls.some(call => call.table === 'automation_comments' && call.type === 'update'
            && call.filters.some(([column, value]) => column === 'status_reason' && value === 'paused')));
        assert.equal((await call(target, 'PUT', '/automations/accounts/ig-theirs', { paused: true })).status, 404);
        assert.deepEqual(audits(target.supabase), ['automation_account.paused', 'automation_account.resumed']);
    });

    test('turning on comment events calls Instagram with the account\'s token and reports Instagram\'s refusal', async () => {
        const target = server();
        const { body } = await call(target, 'POST', '/automations/accounts/ig1/subscribe');
        assert.ok(body.account.subscribedAt);
        assert.equal(new URL(graph[0].url).searchParams.get('access_token'), 'TOKEN-1');
        subscribeAnswer = () => reply({ success: false });
        const refused = await call(target, 'POST', '/automations/accounts/ig1/subscribe');
        assert.equal(refused.status, 502);
        assert.match(refused.body.message, /did not confirm the webhook subscription/);
        assert.equal((await call(target, 'POST', '/automations/accounts/ig-theirs/subscribe')).status, 404);
    });
});
