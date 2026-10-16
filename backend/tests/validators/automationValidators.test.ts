import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseActivityQuery, parseAutomationAccount, parseAutomationRule, parseAutomationRuleUpdate, parseAutomationTest, parseStatsQuery,
    parseWebhookVerification,
} from '../../validators/automationValidators.ts';

const valid = { accountId: 'ig1', name: 'Guide', keywords: ['GUIDE'], replyText: 'Here it is' };

test('a new rule gets its defaults: contains, ignoring case, every post, off, no link and no own limit', () => {
    assert.deepEqual(parseAutomationRule(valid), {
        accountId: 'ig1', name: 'Guide', keywords: ['GUIDE'], matchMode: 'contains', caseSensitive: false, mediaIds: [],
        replyText: 'Here it is', linkUrl: null, enabled: false, hourlyLimit: null,
    });
});

test('keywords are trimmed, blanks dropped and repeats removed, ignoring case unless the rule is case sensitive', () => {
    assert.deepEqual(parseAutomationRule({ ...valid, keywords: [' guide ', 'GUIDE', '', 'Course'] }).keywords, ['guide', 'Course']);
    assert.deepEqual(parseAutomationRule({ ...valid, caseSensitive: true, keywords: ['guide', 'GUIDE'] }).keywords, ['guide', 'GUIDE']);
});

test('a rule needs an account, a name, a keyword and a reply, each with a message saying what to add', () => {
    assert.throws(() => parseAutomationRule({ ...valid, accountId: '' }), /Choose the Instagram account/);
    assert.throws(() => parseAutomationRule({ ...valid, name: ' ' }), /Give the rule a name/);
    assert.throws(() => parseAutomationRule({ ...valid, keywords: [' '] }), /Add at least one keyword/);
    assert.throws(() => parseAutomationRule({ ...valid, keywords: 'GUIDE' }), /keywords must be a list of words/);
    assert.throws(() => parseAutomationRule({ ...valid, replyText: '' }), /Write the reply to send/);
});

test('sizes are capped: name, keyword count and length, reply and posts', () => {
    assert.throws(() => parseAutomationRule({ ...valid, name: 'x'.repeat(81) }), /at most 80/);
    assert.throws(() => parseAutomationRule({ ...valid, keywords: Array.from({ length: 11 }, (_, i) => `k${i}`) }), /at most 10 keywords/);
    assert.throws(() => parseAutomationRule({ ...valid, keywords: ['x'.repeat(101)] }), /at most 100/);
    assert.throws(() => parseAutomationRule({ ...valid, replyText: 'x'.repeat(1001) }), /at most 1000/);
    assert.throws(() => parseAutomationRule({ ...valid, mediaIds: Array.from({ length: 51 }, (_, i) => String(i)) }), /at most 50 posts/);
    assert.throws(() => parseAutomationRule({ ...valid, mediaIds: ['abc'] }), /Instagram post ids/);
});

test('the link must be https, without a user name or password', () => {
    assert.equal(parseAutomationRule({ ...valid, linkUrl: ' https://example.com/guide ' }).linkUrl, 'https://example.com/guide');
    assert.equal(parseAutomationRule({ ...valid, linkUrl: '' }).linkUrl, null);
    assert.throws(() => parseAutomationRule({ ...valid, linkUrl: 'http://example.com' }), /must start with https/);
    assert.throws(() => parseAutomationRule({ ...valid, linkUrl: 'javascript:alert(1)' }), /must start with https/);
    assert.throws(() => parseAutomationRule({ ...valid, linkUrl: 'example.com' }), /full address/);
    assert.throws(() => parseAutomationRule({ ...valid, linkUrl: 'https://user:pass@example.com' }), /user name or password/);
});

test('the hourly limit is a whole number up to Instagram\'s 750, or null for none', () => {
    assert.equal(parseAutomationRule({ ...valid, hourlyLimit: 30 }).hourlyLimit, 30);
    assert.equal(parseAutomationRule({ ...valid, hourlyLimit: null }).hourlyLimit, null);
    assert.throws(() => parseAutomationRule({ ...valid, hourlyLimit: 751 }), /from 1 to 750/);
    assert.throws(() => parseAutomationRule({ ...valid, hourlyLimit: 2.5 }), /from 1 to 750/);
    assert.throws(() => parseAutomationRule({ ...valid, matchMode: 'regex' }), /contains or exact/);
});

test('an update keeps only the fields sent, can clear the link and the limit, and refuses an empty body', () => {
    assert.deepEqual(parseAutomationRuleUpdate({ enabled: true }), { enabled: true });
    assert.deepEqual(parseAutomationRuleUpdate({ linkUrl: null, hourlyLimit: null, accountId: 'other' }), { linkUrl: null, hourlyLimit: null });
    assert.deepEqual(parseAutomationRuleUpdate({ keywords: ['a', 'A'], caseSensitive: true }), { keywords: ['a', 'A'], caseSensitive: true });
    assert.throws(() => parseAutomationRuleUpdate({}), /Nothing to change/);
    assert.throws(() => parseAutomationRuleUpdate({ name: '' }), /Give the rule a name/);
});

test('a test needs a sample comment besides the rule draft', () => {
    const parsed = parseAutomationTest({ keywords: ['GUIDE'], replyText: 'Hi', comment: ' guide ', mediaId: '' });
    assert.equal(parsed.comment, 'guide');
    assert.equal(parsed.mediaId, undefined);
    assert.throws(() => parseAutomationTest({ keywords: ['GUIDE'], replyText: 'Hi' }), /Type a sample comment/);
});

test('activity filters are checked and dates normalised; the page size defaults to 50 and stops at 100', () => {
    assert.deepEqual(parseActivityQuery({ status: 'failed, needs_review,failed', from: '2026-10-01', before: '2026-10-10T00:00:00.123456+00:00|abc-1' }), {
        accountId: undefined, ruleId: undefined, statuses: ['failed', 'needs_review'], from: '2026-10-01T00:00:00.000Z', to: undefined,
        before: { createdAt: '2026-10-10T00:00:00.123456+00:00', id: 'abc-1' }, limit: 50,
    });
    assert.throws(() => parseActivityQuery({ before: '2026-10-10T00:00:00Z' }), /nextBefore value of the previous page/);
    assert.throws(() => parseActivityQuery({ before: '2026-10-10T00:00:00Z|a",id.gt."0' }), /nextBefore value of the previous page/);
    assert.equal(parseActivityQuery({ limit: '100' }).limit, 100);
    assert.throws(() => parseActivityQuery({ limit: '101' }), /from 1 to 100/);
    assert.throws(() => parseActivityQuery({ status: 'failed,lost' }), /status must be one of/);
    assert.throws(() => parseStatsQuery({ from: 'yesterday' }), /from must be a date/);
});

test('pausing needs a true or false, and the webhook check reads the hub parameters', () => {
    assert.deepEqual(parseAutomationAccount({ paused: false }), { paused: false });
    assert.throws(() => parseAutomationAccount({}), /paused must be true or false/);
    assert.deepEqual(parseWebhookVerification({ 'hub.mode': 'subscribe', 'hub.verify_token': 'tok', 'hub.challenge': '123' }), {
        mode: 'subscribe', verifyToken: 'tok', challenge: '123',
    });
});
