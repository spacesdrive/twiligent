process.env.TZ = 'UTC';

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    DAY_NAMES, DAY_MS, sumOf, roundedAverage, medianOf, countWithinDays, postFrequency,
    consistencyScore, bestToAverageRatio, pickHighest, monthKey,
} from '../../services/analyticsMath.ts';

const NOW = Date.parse('2026-09-01T12:00:00Z');
const daysAgo = (days) => new Date(NOW - days * DAY_MS);

describe('analyticsMath', () => {
    test('day names start on Sunday like Date#getDay', () => {
        assert.deepStrictEqual(DAY_NAMES, ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
        assert.equal(DAY_MS, 86400000);
    });

    test('sumOf and roundedAverage', () => {
        assert.equal(sumOf([{ score: 2 }, { score: 5 }], item => item.score), 7);
        assert.equal(sumOf([], item => item.score), 0);
        assert.equal(roundedAverage(7, 2), 4);
        assert.equal(roundedAverage(7, 0), 0);
    });

    test('medianOf rounds the middle pair and does not reorder its input', () => {
        const values = [9, 1, 4];
        assert.equal(medianOf(values), 4);
        assert.deepStrictEqual(values, [9, 1, 4]);
        assert.equal(medianOf([1, 2, 3, 6]), 3);
        assert.equal(medianOf([1, 2]), 2);
    });

    test('countWithinDays includes the boundary day', () => {
        const dates = [daysAgo(0), daysAgo(7), daysAgo(7.5), daysAgo(30)];
        assert.equal(countWithinDays(dates, NOW, 7), 2);
        assert.equal(countWithinDays(dates, NOW, 30), 4);
    });

    test('postFrequency spreads the post count over at least one day', () => {
        assert.deepStrictEqual(postFrequency([daysAgo(1)], 5), { perWeek: 0, perMonth: 0 });
        assert.deepStrictEqual(postFrequency([daysAgo(0), daysAgo(14)], 4), { perWeek: 2, perMonth: 8.6 });
        assert.deepStrictEqual(postFrequency([daysAgo(0), daysAgo(0)], 3), { perWeek: 21, perMonth: 90 });
    });

    test('consistencyScore needs three values and handles a zero mean', () => {
        assert.equal(consistencyScore([1, 2]), 0);
        assert.equal(consistencyScore([5, 5, 5]), 100);
        assert.equal(consistencyScore([0, 0, 0]), 100);
        assert.equal(consistencyScore([-1, 0, 1]), 9);
        assert.equal(consistencyScore([10, 20, 30]), 71);
    });

    test('bestToAverageRatio and pickHighest keep the first of equal items', () => {
        assert.equal(bestToAverageRatio(50, 12), 4.2);
        assert.equal(bestToAverageRatio(50, 0), 0);
        const items = [{ id: 'a', value: 1 }, { id: 'b', value: 3 }, { id: 'c', value: 3 }];
        assert.equal(pickHighest(items, 'value').id, 'b');
        assert.equal(pickHighest([], 'value'), undefined);
    });

    test('monthKey uses local time', () => {
        assert.equal(monthKey(new Date('2026-01-31T23:30:00Z')), '2026-01');
        assert.equal(monthKey(new Date('2025-12-01T00:00:00Z')), '2025-12');
    });
});
