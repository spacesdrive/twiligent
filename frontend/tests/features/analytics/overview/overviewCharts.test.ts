import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_SERIES, audienceChartDataOf, audienceLegendOf, audienceDotColor, commentByContentOf, engagementByContentOf,
  categoryViewDataOf, commentByCategoryOf, karmaByAccountOf,
} from '../../../../src/features/analytics/overview/overviewCharts.ts';

const groups = {
  youtube: [{ title: 'A channel with a long name', subscriberCount: 10 }],
  instagram: [{ username: 'fold', followersCount: 5 }],
  reddit: [{ username: 'averyverylongname', totalKarma: 3, postKarma: 2 }, { username: 'b', postKarma: 9 }],
};
const categoryStats = [{ category: 'Technology news', rdKarma: 4, views: 10, ytComments: 1, rdComments: 2 }];

test('audience chart shortens names and keeps category karma only', () => {
  assert.deepEqual(audienceChartDataOf(groups, categoryStats), [
    { name: 'A channel wi…', value: 10, type: 'youtube' },
    { name: 'fold', value: 5, type: 'instagram' },
    { name: 'u/averyveryl', value: 3, type: 'reddit' },
    { name: 'u/b', value: 0, type: 'reddit' },
    { name: 'Technology n…', value: 4, type: 'category' },
  ]);
});

test('legend lists only platforms with data', () => {
  const labels = audienceLegendOf({ youtube: [], instagram: [{}], reddit: [] }, []).map(item => item.label);
  assert.deepEqual(labels, ['Instagram followers']);
  assert.equal(audienceDotColor('category'), CATEGORY_SERIES);
  assert.equal(audienceDotColor('reddit'), 'var(--chart-4)');
});

test('tracked content charts rank the top items', () => {
  const tracked = [
    { contentType: 'youtube', title: 'Video', commentCount: 3, likeCount: 8 },
    { url: 'https://reddit.com/r/x/comments/abc', numComments: 7, score: 1 },
  ];
  assert.deepEqual(commentByContentOf(tracked), [
    { name: 'https://reddit.c', comments: 7 },
    { name: 'Video', comments: 3 },
  ]);
  assert.deepEqual(engagementByContentOf(tracked).map(row => row.engagement), [8, 1]);
  const many = Array.from({ length: 20 }, (_, i) => ({ title: `Post ${i}`, numComments: i }));
  assert.equal(commentByContentOf(many).length, 12);
});

test('category and karma charts', () => {
  assert.deepEqual(categoryViewDataOf(categoryStats), [{ name: 'Technology news', views: 10 }]);
  assert.deepEqual(commentByCategoryOf(categoryStats), [{ name: 'Technology news', comments: 3 }]);
  assert.deepEqual(karmaByAccountOf(groups.reddit), [{ name: 'u/b', karma: 9 }, { name: 'u/averyverylongn', karma: 2 }]);
});
