import { test } from 'node:test';
import assert from 'node:assert/strict';
import { healthWarning } from '../../lib/automationHealth.ts';
import type { QueueHealth } from '../../lib/automationHealth.ts';

const NOW = Date.parse('2026-10-16T12:00:00Z');
const HEALTHY: QueueHealth = { due: 0, oldestDueAt: null, waiting: 3, stale: 0, needsReview: 1, followupsDue: 0, pausedAccounts: 1, limitedAccounts: 0 };

test('a queue that keeps up gives no warning, whatever waits for later', () => {
    assert.equal(healthWarning(HEALTHY, NOW), null);
    assert.equal(healthWarning({ ...HEALTHY, due: 4, oldestDueAt: '2026-10-16T11:55:00Z' }, NOW), null);
});

test('replies due for more than ten minutes, or held by stopped runs, give one warning line naming both', () => {
    const warning = healthWarning({ ...HEALTHY, due: 40, oldestDueAt: '2026-10-16T11:45:00Z', stale: 2 }, NOW);
    assert.equal(warning, 'automation queue behind: the oldest due reply has waited 15 minutes; 2 replies are held by runs that stopped');
});
