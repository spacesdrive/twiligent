import { test } from 'node:test';
import assert from 'node:assert/strict';
import { failureMessage } from '../../src/lib/apiErrors.ts';

test('a client error shows the server message as it is', () => {
    assert.equal(failureMessage(404, { success: false, code: 'NOT_FOUND', message: 'Account not found', requestId: 'r1' }), 'Account not found');
});

test('a server error adds the request id the user can quote', () => {
    assert.equal(
        failureMessage(500, { success: false, code: 'DATABASE_ERROR', message: 'The database request failed. Try again in a moment.', requestId: 'r2' }),
        'The database request failed. Try again in a moment. (request r2)',
    );
});

test('a body that is not the error contract still explains the status', () => {
    assert.equal(failureMessage(502, null), 'The server answered with status 502. Try again in a moment.');
});
