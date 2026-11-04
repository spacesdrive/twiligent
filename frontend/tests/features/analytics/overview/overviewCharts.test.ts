import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  audienceChartDataOf, audienceDescription, audienceLegendOf, audienceDotColor, commentByContentOf, likesByContentOf,
  categoryViewDataOf, commentByCategoryOf, likesByCategoryOf,
} from '../../../../src/features/analytics/overview/overviewCharts.ts';

const groups = {
  youtube: [{ title: 'A channel with a long name', subscriberCount: 10 }],
  instagram: [{ username: 'fold', followersCount: 5 }, { title: 'Paper' }],
};
const categoryStats = [
  { category: 'Technology news', views: 10, likes: 3, comments: 3 },
  { category: 'Art', views: 4, likes: 7, comments: 1 },
];

test('audience chart shortens names and counts subscribers and followers', () => {
  assert.deepEqual(audienceChartDataOf(groups), [
    { name: 'A channel wi…', value: 10, type: 'youtube' },
    { name: 'fold', value: 5, type: 'instagram' },
    { name: 'Paper', value: 0, type: 'instagram' },
  ]);
});

test('the audience description names what each point counts, in full', () => {
  const points = [{ name: 'Kitchen', value: 12345, type: 'youtube' as const }, { name: 'Fold', value: 40, type: 'instagram' as const }];
  assert.equal(audienceDescription(points), 'Kitchen, YouTube subscribers: 12,345. Fold, Instagram followers: 40.');
  assert.equal(audienceDescription([]), 'No data yet.');
});

test('legend lists only platforms with data', () => {
  const labels = audienceLegendOf({ youtube: [], instagram: [{}] }).map(item => item.label);
  assert.deepEqual(labels, ['Instagram followers']);
  assert.equal(audienceDotColor('youtube'), 'var(--chart-1)');
  assert.equal(audienceDotColor('instagram'), 'var(--chart-3)');
});

test('tracked video charts rank the top items', () => {
  const tracked = [
    { contentType: 'youtube', title: 'Video', commentCount: 3, likeCount: 8 },
    { contentType: 'youtube', url: 'https://youtu.be/abcdefghijk', commentCount: 7, likeCount: 1 },
  ];
  assert.deepEqual(commentByContentOf(tracked), [
    { name: 'https://youtu.be', comments: 7 },
    { name: 'Video', comments: 3 },
  ]);
  assert.deepEqual(likesByContentOf(tracked).map(row => row.likes), [8, 1]);
  const many = Array.from({ length: 20 }, (_, i) => ({ title: `Video ${i}`, commentCount: i }));
  assert.equal(commentByContentOf(many).length, 12);
});

test('category charts rank categories by views, comments and likes', () => {
  assert.deepEqual(categoryViewDataOf(categoryStats), [{ name: 'Technology news', views: 10 }, { name: 'Art', views: 4 }]);
  assert.deepEqual(commentByCategoryOf(categoryStats), [{ name: 'Technology news', comments: 3 }, { name: 'Art', comments: 1 }]);
  assert.deepEqual(likesByCategoryOf(categoryStats), [{ name: 'Art', likes: 7 }, { name: 'Technology news', likes: 3 }]);
});
