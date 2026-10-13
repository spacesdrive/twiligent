import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createOAuthState, verifyOAuthState } from './oauthState.js';

test('a state verifies back to its user id', async () => {
    const state = await createOAuthState('user-123', 'secret');
    assert.equal(await verifyOAuthState(state, 'secret'), 'user-123');
});

test('a state signed with another secret is rejected', async () => {
    const state = await createOAuthState('user-123', 'secret');
    assert.equal(await verifyOAuthState(state, 'other-secret'), null);
});

test('a tampered payload is rejected', async () => {
    const state = await createOAuthState('user-123', 'secret');
    const [, signature] = state.split('.');
    const forgedPayload = btoa(`attacker:${Date.now()}`).replace(/=+$/, '');
    assert.equal(await verifyOAuthState(`${forgedPayload}.${signature}`, 'secret'), null);
});

test('a state without a signature is rejected', async () => {
    assert.equal(await verifyOAuthState('no-separator', 'secret'), null);
});

test('a state older than 10 minutes is rejected', async () => {
    mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
    try {
        const state = await createOAuthState('user-123', 'secret');
        mock.timers.tick(10 * 60 * 1000 + 1);
        assert.equal(await verifyOAuthState(state, 'secret'), null);
    } finally {
        mock.timers.reset();
    }
});
