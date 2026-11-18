import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterRules, readRuleFilters, ruleFilterCounts, ruleMatchesQuery } from '../../../src/features/automations/ruleList.ts';
import type { RuleFilters } from '../../../src/features/automations/ruleList.ts';
import type { AutomationRule } from '../../../../shared/types/automation.ts';

function rule(id: string, overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id, accountId: 'ig1', name: `Rule ${id}`, keywords: [], matchMode: 'any', caseSensitive: false, mediaIds: [], privateReplyEnabled: true,
    replyText: 'Here is the link', linkUrl: null, publicReplyEnabled: false, publicReplyTexts: [], enabled: true, hourlyLimit: null,
    requireFollow: false, followPromptText: null, notFollowingText: null, createdAt: 'x', updatedAt: 'x', ...overrides,
  };
}

const ALL: RuleFilters = { query: '', state: 'all', applies: 'all' };
const rules = [
  rule('a', { name: 'Giveaway', keywords: ['WIN'], mediaIds: ['m1'] }),
  rule('b', { name: 'Post 2026-11-05: TradingAgents', enabled: false, mediaIds: ['m2'] }),
  rule('c', { name: 'Guide', keywords: ['GUIDE'], publicReplyTexts: ['Check your DMs'], linkUrl: 'https://example.com/guide' }),
];

test('search finds a rule by its name, a keyword, its reply, its link or a public wording, in any letter case', () => {
  assert.equal(ruleMatchesQuery(rules[0], 'give'), true);
  assert.equal(ruleMatchesQuery(rules[0], 'win'), true);
  assert.equal(ruleMatchesQuery(rules[2], 'EXAMPLE.COM'), true);
  assert.equal(ruleMatchesQuery(rules[2], 'check your'), true);
  assert.equal(ruleMatchesQuery(rules[1], 'here is the'), true);
  assert.equal(ruleMatchesQuery(rules[0], '  '), true);
  assert.equal(ruleMatchesQuery(rules[0], 'guide'), false);
});

test('filters combine and keep the rules in their own order', () => {
  assert.deepEqual(filterRules(rules, ALL).map(r => r.id), ['a', 'b', 'c']);
  assert.deepEqual(filterRules(rules, { ...ALL, state: 'off' }).map(r => r.id), ['b']);
  assert.deepEqual(filterRules(rules, { ...ALL, state: 'on' }).map(r => r.id), ['a', 'c']);
  assert.deepEqual(filterRules(rules, { ...ALL, applies: 'chosen' }).map(r => r.id), ['a', 'b']);
  assert.deepEqual(filterRules(rules, { ...ALL, applies: 'every' }).map(r => r.id), ['c']);
  assert.deepEqual(filterRules(rules, { query: 'post', state: 'off', applies: 'chosen' }).map(r => r.id), ['b']);
  assert.deepEqual(filterRules(rules, { query: 'post', state: 'on', applies: 'chosen' }), []);
});

test('each filter choice counts what it would show with the other filters kept', () => {
  assert.deepEqual(ruleFilterCounts(rules, { ...ALL, applies: 'chosen' }), {
    state: { all: 2, on: 1, off: 1 },
    applies: { all: 3, chosen: 2, every: 1 },
  });
});

test('a choice in the address that is not an option falls back to all', () => {
  assert.deepEqual(readRuleFilters({ q: 'win', state: 'off', applies: 'chosen' }), { query: 'win', state: 'off', applies: 'chosen' });
  assert.deepEqual(readRuleFilters({ q: '', state: 'maybe', applies: 'some' }), ALL);
});
