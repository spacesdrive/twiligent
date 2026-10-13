import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  youtubeStatsOf, redditStatsOf, sortedByViews, sortedByKarma, chartDataOf, platformSplit, categoryDescription,
  itemsSubtitle, viewsMetric, karmaMetric, commentsSubtitle, redditViewsMetric, upvoteRatioLabel,
} from './trackedCategoryStats.js';

const videos = [
  { id: 'y1', contentType: 'youtube', title: 'A very long video title here', viewCount: 2000, likeCount: 100, commentCount: 7 },
  { id: 'y2', contentType: 'youtube', url: 'https://youtu.be/x', viewCount: 1000, likeCount: 1 },
];
const posts = [
  { id: 'r1', title: 'Post one', score: 40, numComments: 3, upvoteRatio: 0.9, manualViews: 500 },
  { id: 'r2', title: 'Post two', score: 60, numComments: 1, upvoteRatio: 0.7 },
];

test('YouTube totals, averages and like ratio', () => {
  assert.deepEqual(youtubeStatsOf(videos), {
    count: 2, views: 3000, likes: 101, comments: 7, avgViews: 1500, avgLikes: 51, avgComments: 4, likeRatio: '3.37',
  });
  assert.equal(youtubeStatsOf([]).likeRatio, '0');
  assert.equal(youtubeStatsOf([]).avgViews, 0);
});

test('Reddit totals use karma and only count entered views', () => {
  const stats = redditStatsOf(posts);
  assert.deepEqual(stats, { count: 2, karma: 100, comments: 4, views: 500, withViews: 1, avgKarma: 50, avgComments: 2, avgRatio: 0.8 });
  assert.equal(redditStatsOf([]).avgRatio, 0);
});

test('lists sort by views and karma without changing the input', () => {
  assert.deepEqual(sortedByViews([...videos].reverse()).map(item => item.id), ['y1', 'y2']);
  assert.deepEqual(sortedByKarma(posts).map(item => item.id), ['r2', 'r1']);
  assert.equal(posts[0].id, 'r1');
});

test('chart data trims names and keeps the data key', () => {
  assert.deepEqual(chartDataOf(videos, 'views', item => item.viewCount ?? 0), [
    { name: 'A very long vide', views: 2000 },
    { name: 'https://youtu.be', views: 1000 },
  ]);
  assert.equal(chartDataOf(Array.from({ length: 20 }, () => ({ score: 1 })), 'karma', item => item.score).length, 12);
});

test('platform parts show only for platforms with items', () => {
  assert.equal(platformSplit(1, 0, 'yt', 'rd'), 'yt');
  assert.equal(platformSplit(2, 3, 'yt', 'rd'), 'yt, rd');
  assert.equal(categoryDescription(1, 1, 0), '1 item, 1 YouTube');
  assert.equal(categoryDescription(3, 1, 2), '3 items, 1 YouTube, 2 Reddit');
});

test('overview metrics match the page wording', () => {
  const ytStats = youtubeStatsOf(videos);
  const rdStats = redditStatsOf(posts);
  assert.equal(itemsSubtitle(ytStats, rdStats), '2 YouTube videos, 2 Reddit posts');
  assert.deepEqual(viewsMetric(ytStats, rdStats), { value: '3.5K', subtitle: '3.0K YouTube, 500 Reddit' });
  assert.deepEqual(viewsMetric(youtubeStatsOf([]), redditStatsOf([])), { value: '-', subtitle: 'No views recorded yet' });
  assert.deepEqual(karmaMetric(rdStats), { value: '100', subtitle: '50 per post on average' });
  assert.deepEqual(karmaMetric(redditStatsOf([])), { value: '-', subtitle: 'No Reddit posts in this category' });
  assert.equal(commentsSubtitle(ytStats, redditStatsOf([])), '7 YouTube');
});

test('Reddit view and ratio labels', () => {
  assert.deepEqual(redditViewsMetric(redditStatsOf(posts)), { value: '500', subtitle: 'Across 2 posts' });
  assert.deepEqual(redditViewsMetric(redditStatsOf([posts[1]])), { value: '-', subtitle: 'Reddit does not report views. Add them per post.' });
  assert.equal(upvoteRatioLabel(0.8), '80%');
  assert.equal(upvoteRatioLabel(0), '-');
});
