import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChannelInput } from '../../validators/accountValidators.ts';
import { ValidationError } from '../../lib/errors.ts';

test('the channel body keeps the trimmed input and asks for one when it is missing', () => {
    assert.deepEqual(parseChannelInput({ input: ' @creator ' }), { input: '@creator' });
    assert.throws(() => parseChannelInput({ input: '  ' }), new ValidationError('Enter a channel URL, @handle or channel ID'));
});
