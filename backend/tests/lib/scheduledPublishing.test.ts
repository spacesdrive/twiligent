import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    MAX_PUBLISH_ATTEMPTS, PUBLISH_LEASE_MS, containerStep, failureMessage, failureOutcome, isTransientGraphCode, staleClaimCutoff,
} from '../../lib/scheduledPublishing.ts';

describe('scheduled publishing rules', () => {
    test('the lease outlasts the 14 minute limit both schedulers run under', () => {
        assert.ok(PUBLISH_LEASE_MS > 14 * 60 * 1000);
        assert.equal(staleClaimCutoff(Date.parse('2026-09-01T12:00:00Z')), '2026-09-01T11:40:00.000Z');
    });

    test('a container that already went out is never published again, and a ready one is published as it is', () => {
        assert.equal(containerStep('PUBLISHED'), 'published');
        assert.equal(containerStep('FINISHED'), 'publish');
        assert.equal(containerStep('IN_PROGRESS'), 'wait');
        assert.equal(containerStep('EXPIRED'), 'recreate');
        assert.equal(containerStep('ERROR'), 'fail');
    });

    test('only the Graph API codes Meta calls temporary are retried', () => {
        assert.equal(isTransientGraphCode(2), true);
        assert.equal(isTransientGraphCode(9007), true);
        assert.equal(isTransientGraphCode(190), false);
        assert.equal(isTransientGraphCode(undefined), false);
    });

    test('a passing failure retries until the last attempt, and a definite one fails at once', () => {
        assert.equal(failureOutcome(true, 1), 'retry');
        assert.equal(failureOutcome(true, MAX_PUBLISH_ATTEMPTS), 'fail');
        assert.equal(failureOutcome(false, 1), 'fail');
    });

    test('the final message says publishing stopped only when retries ran out', () => {
        assert.equal(failureMessage('Invalid image', false, 1), 'Invalid image');
        assert.equal(failureMessage('Instagram API unreachable (reset)', true, MAX_PUBLISH_ATTEMPTS),
            'Instagram API unreachable (reset). Publishing stopped after 3 attempts; schedule the post again.');
    });
});
