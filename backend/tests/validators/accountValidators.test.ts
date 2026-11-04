import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChannelInput, parseInstagramToken } from '../../validators/accountValidators.ts';
import { ValidationError } from '../../lib/errors.ts';

test('the channel body keeps the trimmed input and asks for one when it is missing', () => {
    assert.deepEqual(parseChannelInput({ input: ' @creator ' }), { input: '@creator' });
    assert.throws(() => parseChannelInput({ input: '  ' }), new ValidationError('Enter a channel URL, @handle or channel ID'));
});

test('the Instagram token body keeps the trimmed token and refuses an empty one', () => {
    assert.deepEqual(parseInstagramToken({ accessToken: ' TOKEN ' }), { accessToken: 'TOKEN' });
    assert.throws(() => parseInstagramToken({}), new ValidationError('Access token is required'));
});
