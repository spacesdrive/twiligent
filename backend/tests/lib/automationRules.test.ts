import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followTextsProblem, keywordsProblem } from '../../lib/automationRules.ts';

test('a keyword rule needs a keyword and an any-comment rule takes none', () => {
    assert.equal(keywordsProblem('contains', ['GUIDE']), null);
    assert.equal(keywordsProblem('exact', []), 'Add at least one keyword');
    assert.equal(keywordsProblem('any', []), null);
    assert.match(keywordsProblem('any', ['GUIDE'])!, /answers any comment has no keywords/);
});

test('a followers-only rule needs both of its messages; any other rule needs neither', () => {
    assert.equal(followTextsProblem({ requireFollow: false, followPromptText: null, notFollowingText: null }), null);
    assert.match(followTextsProblem({ requireFollow: true, followPromptText: null, notFollowingText: 'x' })!, /asks people to follow you and reply/);
    assert.match(followTextsProblem({ requireFollow: true, followPromptText: 'x', notFollowingText: null })!, /reminder/);
    assert.equal(followTextsProblem({ requireFollow: true, followPromptText: 'x', notFollowingText: 'y' }), null);
});
