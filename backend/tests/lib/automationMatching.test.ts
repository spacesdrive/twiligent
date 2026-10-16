import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coversMedia, matchedKeyword, pickRule, ruleMatch } from '../../lib/automationMatching.ts';
import type { MatchableRule } from '../../lib/automationMatching.ts';

function rule(overrides: Partial<MatchableRule> = {}): MatchableRule {
    return { keywords: ['GUIDE'], matchMode: 'contains', caseSensitive: false, mediaIds: [], ...overrides };
}

test('an any-comment rule answers every comment with something in it, emoji included, and names no keyword', () => {
    const any = rule({ matchMode: 'any', keywords: [] });
    assert.deepEqual(ruleMatch('love this', any), { rule: any, keyword: null });
    assert.deepEqual(ruleMatch('🔥', any), { rule: any, keyword: null });
    assert.equal(ruleMatch('   ', any), null);
});

test('the most specific rule answers: this post\'s keyword rule, then this post\'s any-comment rule, then the same for every post', () => {
    const everyAny = rule({ matchMode: 'any', keywords: [] });
    const everyKeyword = rule({ keywords: ['GUIDE'] });
    const postAny = rule({ matchMode: 'any', keywords: [], mediaIds: ['C'] });
    const postKeyword = rule({ keywords: ['GUIDE'], mediaIds: ['C'] });
    const all = [everyAny, everyKeyword, postAny, postKeyword];
    assert.equal(pickRule(all, 'GUIDE', 'C')?.rule, postKeyword);
    assert.equal(pickRule(all, 'nice', 'C')?.rule, postAny);
    assert.equal(pickRule(all, 'GUIDE', 'D')?.rule, everyKeyword);
    assert.equal(pickRule(all, 'nice', 'D')?.rule, everyAny);
    assert.equal(pickRule([everyKeyword], 'nice', 'D'), null);
});

test('among rules of the same kind the oldest answers, so two copies of a rule never both reply', () => {
    const first = rule({ matchMode: 'any', keywords: [] });
    const second = rule({ matchMode: 'any', keywords: [] });
    assert.equal(pickRule([first, second], 'hello', '1')?.rule, first);
});

test('contains matches the keyword as a whole word anywhere in the comment, ignoring case', () => {
    assert.equal(matchedKeyword('Please send the guide!', rule()), 'GUIDE');
    assert.equal(matchedKeyword('GUIDE', rule()), 'GUIDE');
    assert.equal(matchedKeyword('guide pls', rule()), 'GUIDE');
    assert.equal(matchedKeyword('#guide', rule()), 'GUIDE');
});

test('contains never matches inside a longer word', () => {
    assert.equal(matchedKeyword('read the guidelines', rule()), null);
    assert.equal(matchedKeyword('misguided', rule()), null);
    assert.equal(matchedKeyword('guide2', rule()), null);
});

test('a phrase keyword matches across any run of spaces', () => {
    assert.equal(matchedKeyword('send   me the   free  guide', rule({ keywords: ['free guide'] })), 'free guide');
});

test('exact matches only a comment that is the keyword, apart from punctuation, emoji and spaces', () => {
    const exact = rule({ matchMode: 'exact' });
    // a folded-hands emoji, written as an escape
    assert.equal(matchedKeyword('  Guide!! \u{1F64F} ', exact), 'GUIDE');
    assert.equal(matchedKeyword('guide please', exact), null);
});

test('case sensitive rules compare the letters as written', () => {
    const sensitive = rule({ caseSensitive: true });
    assert.equal(matchedKeyword('GUIDE', sensitive), 'GUIDE');
    assert.equal(matchedKeyword('guide', sensitive), null);
});

test('full-width and other look-alike characters fold to the plain keyword', () => {
    assert.equal(matchedKeyword('ＧＵＩＤＥ', rule()), 'GUIDE');
});

test('keywords with regular expression characters are matched literally', () => {
    assert.equal(matchedKeyword('price? $9.99', rule({ keywords: ['$9.99'] })), '$9.99');
    assert.equal(matchedKeyword('price? $9x99', rule({ keywords: ['$9.99'] })), null);
});

test('the first keyword of a rule that appears wins, and blank keywords never match', () => {
    assert.equal(matchedKeyword('course and guide', rule({ keywords: ['', 'course', 'guide'] })), 'course');
    assert.equal(matchedKeyword('anything', rule({ keywords: ['  '] })), null);
});

test('a rule with no posts covers every post; one with posts covers only those', () => {
    assert.equal(coversMedia(rule(), '1'), true);
    assert.equal(coversMedia(rule(), null), true);
    assert.equal(coversMedia(rule({ mediaIds: ['1', '2'] }), '2'), true);
    assert.equal(coversMedia(rule({ mediaIds: ['1'] }), '3'), false);
    assert.equal(coversMedia(rule({ mediaIds: ['1'] }), null), false);
});

test('a comment on one reel never triggers a rule meant only for another reel', () => {
    const reelA = { ...rule({ keywords: ['GUIDE'], mediaIds: ['A'] }), id: 'a' };
    const reelB = { ...rule({ keywords: ['COURSE'], mediaIds: ['B'] }), id: 'b' };
    assert.equal(pickRule([reelA, reelB], 'COURSE please', 'A'), null);
    assert.equal(pickRule([reelA, reelB], 'COURSE please', 'B')?.rule.id, 'b');
    assert.equal(pickRule([reelA, reelB], 'GUIDE', 'A')?.rule.id, 'a');
});

test('a rule for this post wins over a rule for every post, then the earlier rule wins', () => {
    const everywhere = { ...rule(), id: 'all' };
    const older = { ...rule({ mediaIds: ['A'] }), id: 'older' };
    const newer = { ...rule({ mediaIds: ['A'] }), id: 'newer' };
    assert.deepEqual(pickRule([everywhere, older, newer], 'guide', 'A'), { rule: older, keyword: 'GUIDE' });
    assert.equal(pickRule([everywhere, older], 'guide', 'B')?.rule.id, 'all');
    assert.equal(pickRule([everywhere], 'hello', 'B'), null);
});
