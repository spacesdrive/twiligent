import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mediaTypeDataOf, karmaSummaryOf, postingFrequencyRows, karmaBreakdownRows, performanceIndicators,
} from '../../../../src/features/analytics/reddit/redditAnalyticsData.ts';
import type { RedditMediaType, RedditPost } from '../../../../../shared/types/reddit.ts';

const labels = { text: 'Text', image: 'Image', video: 'Video', link: 'Link' };

test('media types use their label and a fixed colour per type', () => {
  assert.deepEqual(mediaTypeDataOf({ image: 4, gallery: 1 } as Partial<Record<RedditMediaType, number>>, labels), [
    { name: 'Image', value: 4, color: 'var(--chart-2)' },
    { name: 'gallery', value: 1, color: 'var(--chart-1)' },
  ]);
  assert.deepEqual(mediaTypeDataOf(undefined, labels), []);
});

test('karma summary leads with total karma', () => {
  const items = karmaSummaryOf({ totalKarma: 1500, postKarma: 1000, commentKarma: 500 });
  assert.deepEqual(items.map(item => item.value), ['1.5K', '1.0K', '500', '0']);
  assert.equal(items[0].sub, '1,500');
  assert.equal(items[0].lead, true);
});

test('stat lists fall back to zero', () => {
  assert.deepEqual(postingFrequencyRows({}).map(row => row.value), ['0 posts', '0 posts', '0 posts', 0, 0]);
  const breakdown = karmaBreakdownRows({ avgScore: 12, topPosts: [{ score: 2400 }] as RedditPost[], avgUpvoteRatio: 93 });
  assert.equal(breakdown[0].value, '12');
  assert.equal(breakdown[2].value, '2.4K');
  assert.equal(breakdown[3].value, '93%');
});

test('virality scale grows past ten', () => {
  assert.equal(performanceIndicators({}).at(0)!.max, 10);
  assert.equal(performanceIndicators({ viralityScore: 25 }).at(0)!.max, 25);
  assert.equal(performanceIndicators({ consistencyScore: 80 }).at(1)!.value, 80);
});
