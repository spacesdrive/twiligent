import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRedditUsername, parseRedditAccount } from '../../validators/accountValidators.ts';
import { ValidationError } from '../../lib/errors.ts';

test('a Reddit username is taken from u/name, @name or a pasted profile address', () => {
    assert.equal(normalizeRedditUsername(' u/spez '), 'spez');
    assert.equal(normalizeRedditUsername('/u/spez'), 'spez');
    assert.equal(normalizeRedditUsername('@spez'), 'spez');
    assert.equal(normalizeRedditUsername('https://www.reddit.com/user/spez/'), 'spez');
    assert.equal(normalizeRedditUsername('reddit.com/u/spez?sort=new'), 'spez');
    assert.equal(normalizeRedditUsername('spez'), 'spez');
});

test('the Reddit account body keeps only the username and refuses one that is only a prefix', () => {
    assert.deepEqual(parseRedditAccount({ username: 'u/spez', cookie: ' abc ' }), { username: 'spez', cookie: 'abc' });
    assert.throws(() => parseRedditAccount({ username: 'u/', cookie: 'abc' }), new ValidationError('Enter the Reddit username, such as u/name'));
});
