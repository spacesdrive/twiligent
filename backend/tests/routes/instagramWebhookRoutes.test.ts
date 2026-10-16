import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import instagramWebhookRouter from '../../routes/instagramWebhookRoutes.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FetchMock } from '../fixtures/fakeFetch.ts';
import { accountRow, fakeSupabase, tableRow } from '../fixtures/fakeSupabase.ts';
import type { Row, RpcHandler } from '../fixtures/fakeSupabase.ts';
import { commentNotification, metaSignature } from '../fixtures/metaWebhook.ts';
import { backgroundWork, callRoute, mountWithContext } from '../fixtures/routeHarness.ts';
import { mockRowIds } from '../fixtures/rowIds.ts';
import type { Env } from '../../types/env.ts';

const ENV: Partial<Env> = { INSTAGRAM_APP_SECRET: 'IGSECRET', INSTAGRAM_WEBHOOK_VERIFY_TOKEN: 'verify-me' };
const SENT_AT = Math.floor(Date.now() / 1000);

const inTable = (row: Row, name: string) => row._table === name;

// the queue functions, reduced to what one webhook request does: look up rules, store, claim its comments, reserve, finish
const RPC: Record<string, RpcHandler> = {
    store_automation_comments: (args, table) => {
        const comments: Row[] = [];
        const publicReplies: string[] = [];
        for (const comment of args.p_comments as Row[]) {
            const { public_reply_id: publicReplyId, public_reply_text: publicReplyText, ...fields } = comment;
            let stored = table.find(row => inTable(row, 'automation_comments') && row.ig_user_id === fields.ig_user_id && row.comment_id === fields.comment_id);
            if (!stored) {
                stored = tableRow('automation_comments', fields);
                table.push(stored);
                comments.push({ id: fields.id, status: fields.status });
            }
            const answered = table.some(row => inTable(row, 'automation_public_replies') && row.automation_comment_id === stored.id);
            if (publicReplyId && stored.rule_id === fields.rule_id && !answered) {
                table.push(tableRow('automation_public_replies', { id: publicReplyId, automation_comment_id: stored.id, account_id: stored.account_id, comment_id: stored.comment_id, rule_id: stored.rule_id, reply_text: publicReplyText, status: 'queued' }));
                publicReplies.push(publicReplyId as string);
            }
        }
        return { comments, public_replies: publicReplies };
    },
    claim_automation_public_replies: (args, table) => table
        .filter(row => inTable(row, 'automation_public_replies') && row.status === 'queued' && (args.p_ids as string[]).includes(row.id as string))
        .map(row => {
            row.status = 'processing';
            return { ...row, ig_user_id: '1784', attempts: 0, expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), rule_enabled: true, access_token: 'TOKEN-1' };
        }),
    reserve_automation_public_reply: (args, table) => {
        const row = table.find(candidate => inTable(candidate, 'automation_public_replies') && candidate.id === args.p_id && candidate.status === 'processing');
        if (!row) return [{ outcome: 'gone', retry_at: null }];
        row.status = 'sending';
        return [{ outcome: 'ok', retry_at: null }];
    },
    finish_automation_public_reply: (args, table) => {
        const row = table.find(candidate => inTable(candidate, 'automation_public_replies') && candidate.id === args.p_id && candidate.status === 'sending');
        if (!row) return false;
        Object.assign(row, { status: args.p_status, reply_id: args.p_reply_id });
        return true;
    },
    automation_rules_for_ig_user: (args, table) => table
        .filter(row => inTable(row, 'automation_rules') && row.enabled)
        .filter(row => table.some(account => inTable(account, 'accounts') && account.id === row.account_id && (account.data as Row).igUserId === args.p_ig_user_id)),
    claim_automation_comments: (args, table) => table
        .filter(row => inTable(row, 'automation_comments') && row.status === 'queued' && (args.p_ids as string[]).includes(row.id as string))
        .map(row => {
            row.status = 'processing';
            const rule = table.find(candidate => inTable(candidate, 'automation_rules') && candidate.id === row.rule_id)!;
            const account = table.find(candidate => inTable(candidate, 'accounts') && candidate.id === row.account_id)!;
            return { ...row, rule_enabled: rule.enabled, reply_text: rule.reply_text, link_url: rule.link_url, access_token: (account.data as Row).accessToken };
        }),
    reserve_automation_send: (args, table) => {
        const row = table.find(candidate => inTable(candidate, 'automation_comments') && candidate.id === args.p_id && candidate.status === 'processing');
        if (!row) return [{ outcome: 'gone', retry_at: null }];
        row.status = 'sending';
        return [{ outcome: 'ok', retry_at: null }];
    },
    finish_automation_send: (args, table) => {
        const row = table.find(candidate => inTable(candidate, 'automation_comments') && candidate.id === args.p_id && candidate.status === 'sending');
        if (!row) return false;
        Object.assign(row, { status: args.p_status, message_id: args.p_message_id });
        return true;
    },
    // the follow-up functions, reduced the same way: a waiting comment's sender gets one follow-up
    automation_followups_for_messages: (args, table) => (args.p_messages as Row[]).flatMap(message => {
        const comment = table.find(row => inTable(row, 'automation_comments') && row.recipient_id === message.sender_id && row.gate_status === 'awaiting_reply');
        if (!comment) return [];
        table.push(tableRow('automation_followups', { id: message.id, automation_comment_id: comment.id, account_id: comment.account_id, recipient_id: message.sender_id, status: 'queued' }));
        return [{ id: message.id }];
    }),
    claim_automation_followups: (args, table) => table
        .filter(row => inTable(row, 'automation_followups') && row.status === 'queued' && (args.p_ids as string[]).includes(row.id as string))
        .map(row => {
            row.status = 'processing';
            const comment = table.find(candidate => inTable(candidate, 'automation_comments') && candidate.id === row.automation_comment_id)!;
            const rule = table.find(candidate => inTable(candidate, 'automation_rules') && candidate.id === comment.rule_id)!;
            return {
                ...row, ig_user_id: '1784', attempts: 0, window_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), gate_status: comment.gate_status,
                gate_prompts: 0, rule_enabled: rule.enabled, require_follow: rule.require_follow, reply_text: rule.reply_text, link_url: rule.link_url,
                not_following_text: rule.not_following_text, access_token: 'TOKEN-1',
            };
        }),
    reserve_automation_followup: (args, table) => {
        const row = table.find(candidate => inTable(candidate, 'automation_followups') && candidate.id === args.p_id && candidate.status === 'processing')!;
        Object.assign(row, { status: 'sending', kind: args.p_kind });
        return [{ outcome: 'ok', retry_at: null }];
    },
    finish_automation_followup: (args, table) => {
        const row = table.find(candidate => inTable(candidate, 'automation_followups') && candidate.id === args.p_id)!;
        row.status = args.p_status;
        const comment = table.find(candidate => inTable(candidate, 'automation_comments') && candidate.id === row.automation_comment_id)!;
        comment.gate_status = args.p_gate_status ?? comment.gate_status;
        return true;
    },
};

function seed(): Row[] {
    return [
        tableRow('accounts', accountRow({ id: 'ig1', platform: 'instagram', igUserId: '1784', accessToken: 'TOKEN-1' })),
        tableRow('automation_rules', { id: 'rule-1', user_id: 'user-1', account_id: 'ig1', keywords: ['GUIDE'], match_mode: 'contains', case_sensitive: false, media_ids: [], reply_text: 'Here it is', link_url: 'https://example.com/g', enabled: true }),
    ];
}

let fetchMock: FetchMock | null = null;
let sends: string[] = [];

beforeEach(() => {
    sends = [];
    mockRowIds();
    mock.method(console, 'log', () => {});
    mock.method(console, 'warn', () => {});
    mock.method(console, 'error', () => {});
    fetchMock = installFetch(request => {
        if (request.method === 'GET') return reply({ is_user_follow_business: true });
        sends.push(request.body ?? '');
        return reply({ recipient_id: 'r', message_id: 'mid-1' });
    });
});
afterEach(() => {
    fetchMock?.restore();
    mock.restoreAll();
});

function app(supabase = fakeSupabase(seed(), RPC)) {
    return { supabase, app: mountWithContext(server => server.route('/', instagramWebhookRouter), { supabase }) };
}

async function post(target: ReturnType<typeof app>, body: string, signature: string | null, env: Partial<Env> = ENV) {
    const work = backgroundWork();
    const headers: Record<string, string> = signature ? { 'X-Hub-Signature-256': signature } : {};
    const result = await callRoute(target.app, 'POST', '/webhooks/instagram', { json: body, headers, env, executionCtx: work });
    await work.settle();
    return result;
}

describe('instagram webhook routes', () => {
    test('the verification request gets the bare challenge back only with the right verify token', async () => {
        const { app: server } = app();
        const ok = await callRoute(server, 'GET', '/webhooks/instagram?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=1158201444', { env: ENV });
        assert.deepEqual(ok, { status: 200, body: '1158201444' });
        const wrong = await callRoute(server, 'GET', '/webhooks/instagram?hub.mode=subscribe&hub.verify_token=guess&hub.challenge=1', { env: ENV });
        assert.equal(wrong.status, 403);
        assert.equal(JSON.parse(wrong.body).code, 'FORBIDDEN');
        const unset = await callRoute(server, 'GET', '/webhooks/instagram?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=1', { env: {} });
        assert.equal(unset.status, 503);
    });

    test('a signed comment is stored before the answer, and the reply is sent after it', async () => {
        const target = app();
        const body = JSON.stringify(commentNotification('1784', SENT_AT, [{ id: '555', text: 'send the guide', mediaId: '9001' }]));
        const result = await post(target, body, await metaSignature('IGSECRET', body));
        assert.deepEqual(result, { status: 200, body: '{"success":true}' });
        const stored = target.supabase.table.filter(row => inTable(row, 'automation_comments'));
        assert.equal(stored.length, 1);
        assert.deepEqual([stored[0].comment_id, stored[0].status, stored[0].message_id], ['555', 'accepted', 'mid-1']);
        assert.deepEqual(JSON.parse(sends[0]), { recipient: { comment_id: '555' }, message: { text: 'Here it is\n\nhttps://example.com/g' } });
    });

    test('a signed message from someone waiting on a followers-only reply is answered with the link once they follow', async () => {
        const target = app(fakeSupabase([
            ...seed().map(row => (row.id === 'rule-1' ? { ...row, require_follow: true, follow_prompt_text: 'Follow and reply', not_following_text: 'Follow first' } : row)),
            tableRow('automation_comments', { id: 'gated', account_id: 'ig1', rule_id: 'rule-1', status: 'accepted', recipient_id: '77', gate_status: 'awaiting_reply' }),
        ], RPC));
        const body = JSON.stringify({
            object: 'instagram',
            entry: [{ id: '1784', time: SENT_AT, messaging: [{ sender: { id: '77' }, recipient: { id: '1784' }, timestamp: SENT_AT * 1000, message: { mid: 'm1', text: 'done' } }] }],
        });
        const result = await post(target, body, await metaSignature('IGSECRET', body));
        assert.equal(result.status, 200);
        assert.deepEqual(JSON.parse(sends[0]), { recipient: { id: '77' }, message: { text: 'Here it is\n\nhttps://example.com/g' } });
        const followup = target.supabase.table.find(row => inTable(row, 'automation_followups'))!;
        assert.deepEqual([followup.status, followup.kind], ['accepted', 'link']);
        assert.equal(target.supabase.table.find(row => row.id === 'gated')!.gate_status, 'completed');
    });

    test('a rule with both replies posts the public reply even when the private reply fails, and a redelivery sends neither again', async () => {
        fetchMock?.restore();
        const posted: { path: string; body: Row }[] = [];
        fetchMock = installFetch(request => {
            const path = new URL(request.url).pathname;
            posted.push({ path, body: JSON.parse(request.body ?? '{}') as Row });
            if (path.endsWith('/messages')) return reply({ error: { message: 'Not allowed', code: 10, error_subcode: 2534022 } }, 400);
            return reply({ id: 'reply-1' });
        });
        const target = app(fakeSupabase(seed().map(row => (row.id === 'rule-1'
            ? { ...row, public_reply_enabled: true, public_reply_texts: ['Sent you a message'] }
            : row)), RPC));
        const body = JSON.stringify(commentNotification('1784', SENT_AT, [{ id: '555', text: 'GUIDE', mediaId: '9001' }]));
        const signature = await metaSignature('IGSECRET', body);
        assert.equal((await post(target, body, signature)).status, 200);
        assert.deepEqual(posted.map(request => request.path.replace(/^\/v[\d.]+/, '')), ['/1784/messages', '/555/replies']);
        assert.deepEqual(posted[1].body, { message: 'Sent you a message' });
        const comment = target.supabase.table.find(row => inTable(row, 'automation_comments'))!;
        const publicReply = target.supabase.table.find(row => inTable(row, 'automation_public_replies'))!;
        assert.deepEqual([comment.status, publicReply.status, publicReply.reply_id], ['failed', 'accepted', 'reply-1']);
        assert.equal((await post(target, body, signature)).status, 200);
        assert.equal(posted.length, 2);
    });

    test('the same notification delivered twice sends one reply', async () => {
        const target = app();
        const body = JSON.stringify(commentNotification('1784', SENT_AT, [{ id: '555', text: 'GUIDE' }]));
        const signature = await metaSignature('IGSECRET', body);
        assert.equal((await post(target, body, signature)).status, 200);
        assert.equal((await post(target, body, signature)).status, 200);
        assert.equal(sends.length, 1);
        assert.equal(target.supabase.table.filter(row => inTable(row, 'automation_comments')).length, 1);
    });

    test('a notification signed with the Meta app secret is accepted when META_APP_SECRET is set', async () => {
        const target = app();
        const body = JSON.stringify(commentNotification('1784', SENT_AT, [{ id: '556', text: 'nothing here' }]));
        const result = await post(target, body, await metaSignature('METASECRET', body), { ...ENV, META_APP_SECRET: 'METASECRET' });
        assert.equal(result.status, 200);
        assert.equal(sends.length, 0);
    });

    test('a missing or wrong signature is refused with 401 and nothing is stored', async () => {
        const target = app();
        const body = JSON.stringify(commentNotification('1784', SENT_AT, [{ id: '555', text: 'GUIDE' }]));
        for (const signature of [null, await metaSignature('WRONG', body), 'sha256=00']) {
            const result = await post(target, body, signature);
            assert.equal(result.status, 401);
            assert.equal(JSON.parse(result.body).code, 'UNAUTHORIZED');
        }
        assert.equal(target.supabase.calls.length, 0);
    });

    test('a body that is not an Instagram notification, or is not JSON, is refused with 400 after the signature check', async () => {
        const target = app();
        const page = JSON.stringify({ object: 'page', entry: [] });
        assert.equal((await post(target, page, await metaSignature('IGSECRET', page))).status, 400);
        assert.equal((await post(target, '{not json', await metaSignature('IGSECRET', '{not json'))).status, 400);
    });

    test('a notification over 1 MB is refused before the signature is computed', async () => {
        const target = app();
        const work = backgroundWork();
        const result = await callRoute(target.app, 'POST', '/webhooks/instagram', {
            json: '{}', headers: { 'Content-Length': String(2 * 1024 * 1024), 'X-Hub-Signature-256': 'sha256=00' }, env: ENV, executionCtx: work,
        });
        assert.equal(result.status, 400);
        assert.match(JSON.parse(result.body).message, /larger than 1 MB/);
    });

    test('without the app secret the webhook answers 503 naming the missing secret', async () => {
        const body = '{}';
        const result = await post(app(), body, await metaSignature('IGSECRET', body), {});
        assert.equal(result.status, 503);
        assert.match(JSON.parse(result.body).message, /INSTAGRAM_APP_SECRET/);
    });

    test('when the comments cannot be stored the webhook fails, so Meta delivers it again', async () => {
        const broken = fakeSupabase(seed(), { ...RPC, automation_rules_for_ig_user: () => { throw new Error('connection refused'); } });
        const body = JSON.stringify(commentNotification('1784', SENT_AT, [{ id: '555', text: 'GUIDE' }]));
        const result = await post(app(broken), body, await metaSignature('IGSECRET', body));
        assert.equal(result.status, 500);
        assert.equal(JSON.parse(result.body).code, 'DATABASE_ERROR');
        assert.equal(sends.length, 0);
    });
});
