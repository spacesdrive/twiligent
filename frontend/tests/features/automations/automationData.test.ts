import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_FILTERS, DEFAULT_FOLLOW_PROMPT, DEFAULT_NOT_FOLLOWING, MAX_MESSAGE_BYTES, accountStatus, canRetry, composeReply, emptyRuleForm,
  formToRequest, gateDetail, matchModeLabel, messageBytes, needsMessageEvents, parseKeywords, periodStart, ruleFormProblem, ruleScopeLabel,
  ruleToForm, statusDisplay, summarizeStats,
} from '../../../src/features/automations/automationData.ts';
import type { RuleForm } from '../../../src/features/automations/automationData.ts';
import type { AutomationAccountState, AutomationRule } from '../../../../shared/types/automation.ts';

const NOW = Date.parse('2026-10-16T12:00:00Z');

function form(overrides: Partial<RuleForm> = {}): RuleForm {
  return { ...emptyRuleForm('ig1'), name: 'Guide', keywordsText: 'GUIDE', replyText: 'Here it is', ...overrides };
}

const rule: AutomationRule = {
  id: 'r1', accountId: 'ig1', name: 'Guide', keywords: ['GUIDE', 'LINK'], matchMode: 'exact', caseSensitive: true, mediaIds: ['1', '2'],
  replyText: 'Here it is', linkUrl: 'https://example.com', enabled: false, hourlyLimit: 30, requireFollow: true, followPromptText: 'Follow and reply',
  notFollowingText: 'Follow first', createdAt: 'c', updatedAt: 'u',
};

test('accepted replies say Instagram accepted them, never that they were delivered or read', () => {
  assert.equal(statusDisplay({ status: 'accepted', statusReason: null }).label, 'Accepted by Instagram');
  assert.deepEqual(statusDisplay({ status: 'queued', statusReason: 'paused' }), { label: 'Held', tone: 'warning' });
  assert.equal(statusDisplay({ status: 'needs_review', statusReason: 'no_answer' }).label, 'Needs review');
});

test('an accepted followers-only reply shows where the wait for the person stands', () => {
  const accepted = { status: 'accepted' as const, statusReason: null };
  assert.equal(statusDisplay({ ...accepted, gateStatus: null }).label, 'Accepted by Instagram');
  assert.deepEqual(statusDisplay({ ...accepted, gateStatus: 'awaiting_reply', followup: null }), { label: 'Asked to follow', tone: 'info' });
  assert.deepEqual(statusDisplay({ ...accepted, gateStatus: 'completed' }), { label: 'Link sent', tone: 'success' });
  assert.deepEqual(statusDisplay({ ...accepted, gateStatus: 'closed' }), { label: 'Not following', tone: 'secondary' });
  const failed = { status: 'failed' as const, kind: null, errorMessage: 'Instagram did not say', createdAt: 'x' };
  assert.deepEqual(statusDisplay({ ...accepted, gateStatus: 'awaiting_reply', followup: failed }), { label: 'Follow-up failed', tone: 'destructive' });
  assert.equal(gateDetail({ status: 'accepted', gateStatus: 'awaiting_reply', followup: failed }), 'Instagram did not say');
  assert.match(gateDetail({ status: 'accepted', gateStatus: 'awaiting_reply', followup: null })!, /link goes out if they do/);
  assert.equal(gateDetail({ status: 'accepted', gateStatus: null, followup: null }), null);
});

test('the status filters cover every status exactly once, apart from All', () => {
  const covered = Object.values(ACTIVITY_FILTERS).flatMap(filter => filter.statuses ?? []);
  assert.equal(new Set(covered).size, covered.length);
  assert.equal(covered.length, 10);
});

test('stats become received, matched, accepted, waiting, attention and rate limited counts', () => {
  assert.deepEqual(summarizeStats({
    comments: { ignored: 5, accepted: 3, queued: 1, retry_wait: 1, failed: 2, needs_review: 1, skipped: 1 },
    attempts: { rate_limited: 4, accepted: 3 },
  }), { received: 14, matched: 9, accepted: 3, waiting: 2, attention: 3, rateLimited: 4 });
  assert.deepEqual(summarizeStats({ comments: {}, attempts: {} }), { received: 0, matched: 0, accepted: 0, waiting: 0, attention: 0, rateLimited: 0 });
});

test('a period starts the right length of time before now', () => {
  assert.equal(periodStart('24h', NOW), '2026-10-15T12:00:00.000Z');
  assert.equal(periodStart('30d', NOW), '2026-09-16T12:00:00.000Z');
});

test('rule summaries name the posts covered and how keywords match', () => {
  assert.equal(ruleScopeLabel({ mediaIds: [] }), 'All posts and reels');
  assert.equal(ruleScopeLabel({ mediaIds: ['1'] }), '1 selected post');
  assert.equal(ruleScopeLabel({ mediaIds: ['1', '2'] }), '2 selected posts');
  assert.equal(matchModeLabel({ matchMode: 'contains', caseSensitive: false }), 'Anywhere in the comment');
  assert.equal(matchModeLabel({ matchMode: 'exact', caseSensitive: true }), 'Whole comment, same letter case');
  assert.equal(matchModeLabel({ matchMode: 'any', caseSensitive: true }), 'Any comment');
});

test('a failed follow-up on an accepted reply can be retried inside the 24 hours after the person\'s answer', () => {
  const future = new Date(NOW + 1000).toISOString();
  const followup = (status: 'failed' | 'accepted', hoursAgo: number) => ({ status, kind: null, errorMessage: null, createdAt: new Date(NOW - hoursAgo * 3600_000).toISOString() });
  assert.equal(canRetry({ status: 'accepted', expiresAt: future, followup: followup('failed', 1) }, NOW), true);
  assert.equal(canRetry({ status: 'accepted', expiresAt: future, followup: followup('failed', 25) }, NOW), false);
  assert.equal(canRetry({ status: 'accepted', expiresAt: future, followup: followup('accepted', 1) }, NOW), false);
});

test('only failed, skipped and review items inside the 7 days offer a retry', () => {
  const future = new Date(NOW + 1000).toISOString();
  assert.equal(canRetry({ status: 'failed', expiresAt: future }, NOW), true);
  assert.equal(canRetry({ status: 'needs_review', expiresAt: future }, NOW), true);
  assert.equal(canRetry({ status: 'accepted', expiresAt: future }, NOW), false);
  assert.equal(canRetry({ status: 'failed', expiresAt: new Date(NOW).toISOString() }, NOW), false);
});

test('keywords split on commas and new lines, without blanks or repeats', () => {
  assert.deepEqual(parseKeywords(' GUIDE, guide ,\nLink,, ', false), ['GUIDE', 'Link']);
  assert.deepEqual(parseKeywords('GUIDE, guide', true), ['GUIDE', 'guide']);
});

test('the preview puts the link on its own line and counts bytes as Instagram does', () => {
  assert.equal(composeReply(' Hi ', ' https://e.com '), 'Hi\n\nhttps://e.com');
  assert.equal(composeReply('Hi', '  '), 'Hi');
  assert.equal(messageBytes('é'), 2);
});

test('a rule turns into its form and back without losing a field', () => {
  const editing = ruleToForm(rule);
  assert.deepEqual(editing, {
    accountId: 'ig1', name: 'Guide', keywordsText: 'GUIDE, LINK', matchMode: 'exact', caseSensitive: true, scope: 'selected', mediaIds: ['1', '2'],
    replyText: 'Here it is', linkUrl: 'https://example.com', hourlyLimit: '30', enabled: false,
    requireFollow: true, followPromptText: 'Follow and reply', notFollowingText: 'Follow first',
  });
  const { accountId, name, keywords, matchMode, caseSensitive, mediaIds, replyText, linkUrl, enabled, hourlyLimit, requireFollow, followPromptText, notFollowingText } = rule;
  assert.deepEqual(formToRequest(editing), {
    accountId, name, keywords, matchMode, caseSensitive, mediaIds, replyText, linkUrl, enabled, hourlyLimit, requireFollow, followPromptText, notFollowingText,
  });
});

test('a new rule starts with editable followers-only messages, used only when the option is on', () => {
  const fresh = emptyRuleForm('ig1');
  assert.deepEqual([fresh.requireFollow, fresh.followPromptText, fresh.notFollowingText], [false, DEFAULT_FOLLOW_PROMPT, DEFAULT_NOT_FOLLOWING]);
  assert.equal(ruleFormProblem(form({ requireFollow: true })), null);
  assert.equal(ruleFormProblem(form({ requireFollow: true, followPromptText: ' ' })), 'Write the message that asks people to follow you and reply');
  assert.equal(ruleFormProblem(form({ requireFollow: true, notFollowingText: '' })), 'Write the reminder for people who do not follow you yet');
  assert.match(ruleFormProblem(form({ requireFollow: true, notFollowingText: 'é'.repeat(501) }))!, /followers-only message is 1002 bytes/);
  assert.equal(ruleFormProblem(form({ requireFollow: false, followPromptText: '' })), null);
});

test('an any-comment rule needs no keywords and sends none, even ones typed before switching', () => {
  assert.equal(ruleFormProblem(form({ matchMode: 'any', keywordsText: '' })), null);
  assert.deepEqual(formToRequest(form({ matchMode: 'any', keywordsText: 'GUIDE' })).keywords, []);
});

test('a rule for every post sends no post ids, and blank optional fields become null', () => {
  const request = formToRequest(form({ scope: 'all', mediaIds: ['1'], linkUrl: ' ', hourlyLimit: '' }));
  assert.deepEqual([request.mediaIds, request.linkUrl, request.hourlyLimit], [[], null, null]);
});

test('the form names the first thing to fix, in the order of the fields', () => {
  assert.equal(ruleFormProblem(form()), null);
  assert.equal(ruleFormProblem(form({ accountId: '' })), 'Choose the Instagram account');
  assert.equal(ruleFormProblem(form({ name: ' ' })), 'Give the rule a name');
  assert.equal(ruleFormProblem(form({ keywordsText: ', ,' })), 'Add at least one keyword');
  assert.equal(ruleFormProblem(form({ keywordsText: Array.from({ length: 11 }, (_, i) => `k${i}`).join(',') })), 'A rule can have at most 10 keywords');
  assert.equal(ruleFormProblem(form({ scope: 'selected' })), 'Choose at least one post, or answer comments on every post');
  assert.equal(ruleFormProblem(form({ replyText: '' })), 'Write the reply to send');
  assert.equal(ruleFormProblem(form({ linkUrl: 'http://e.com' })), 'The link must start with https://');
  assert.equal(ruleFormProblem(form({ linkUrl: 'e.com' })), 'The link must be a full address starting with https://');
  assert.equal(ruleFormProblem(form({ hourlyLimit: '0' })), 'The hourly limit must be a whole number from 1 to 750');
  assert.equal(ruleFormProblem(form({ hourlyLimit: '2.5' })), 'The hourly limit must be a whole number from 1 to 750');
  assert.match(ruleFormProblem(form({ replyText: 'é'.repeat(MAX_MESSAGE_BYTES / 2 + 1) }))!, /is 1002 bytes; Instagram accepts at most 1000/);
});

test('an account shows held, paused, cooling down, at its limit, not receiving, follow checks off or receiving, in that order', () => {
  const base: AutomationAccountState = {
    accountId: 'ig1', username: 'me', profilePictureUrl: '', paused: false, cooldownUntil: null, cooldownReason: null, subscribedAt: 'x',
    limitedUntil: null, messagesSubscribed: false,
  };
  assert.equal(accountStatus({ ...base, paused: true, cooldownReason: 'Reconnect it' }, NOW).label, 'Held');
  assert.equal(accountStatus({ ...base, paused: true }, NOW).label, 'Paused');
  assert.equal(accountStatus({ ...base, cooldownUntil: new Date(NOW + 1000).toISOString() }, NOW).label, 'Cooling down');
  assert.equal(accountStatus({ ...base, limitedUntil: new Date(NOW + 1000).toISOString() }, NOW).label, 'At its hourly limit');
  assert.equal(accountStatus({ ...base, cooldownUntil: new Date(NOW - 1000).toISOString() }, NOW).label, 'Receiving comments');
  assert.equal(accountStatus({ ...base, subscribedAt: null }, NOW).label, 'Not receiving comments');
  assert.equal(accountStatus(base, NOW, true).label, 'Follow checks off');
  assert.equal(accountStatus({ ...base, messagesSubscribed: true }, NOW, true).label, 'Receiving comments');
});

test('an account needs message events only while one of its followers-only rules is on', () => {
  const rules = [
    { accountId: 'ig1', enabled: true, requireFollow: false },
    { accountId: 'ig1', enabled: false, requireFollow: true },
    { accountId: 'ig2', enabled: true, requireFollow: true },
  ];
  assert.equal(needsMessageEvents(rules, 'ig1'), false);
  assert.equal(needsMessageEvents(rules, 'ig2'), true);
});
