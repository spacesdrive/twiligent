import { test } from 'node:test';
import assert from 'node:assert/strict';
import { USER_DAILY_UNITS, pacificDay, unitsFor } from '../../lib/youtubeQuota.ts';

test('a search costs 100 units and every list call Twiligent makes costs 1', () => {
    assert.equal(unitsFor('search'), 100);
    for (const endpoint of ['channels', 'playlistItems', 'videos']) assert.equal(unitsFor(endpoint), 1, endpoint);
});

test('the counters follow the Pacific day YouTube resets on, not the UTC day', () => {
    // 07:30 UTC is still the evening before in California
    assert.equal(pacificDay(Date.parse('2026-11-05T07:30:00Z')), '2026-11-04');
    assert.equal(pacificDay(Date.parse('2026-11-05T09:00:00Z')), '2026-11-05');
});

test('one member may spend a quarter of the default daily quota', () => {
    assert.equal(USER_DAILY_UNITS, 2500);
});
