import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  typeRowsOf, contentMixOf, topPostsChartOf, dayOfWeekDataOf, timelineDataOf, instagramChartsOf, followerRatio,
  typeViewsSubtitle, reportedViews,
} from '../../../../src/features/analytics/instagram/instagramAnalyticsData.js';

const typeStats = {
  reel: { count: 3, avgLikes: 10, viewsReported: 3, totalViews: 4500, avgViews: 1500 },
  post: { count: 0 },
  video: { count: 1, avgLikes: 2, viewsReported: 0 },
};

test('type rows keep content types with posts, in display order', () => {
  const rows = typeRowsOf(typeStats);
  assert.deepEqual(rows.map(row => row.type), ['reel', 'video']);
  assert.equal(rows[0].name, 'Reels');
  assert.equal(rows[0].color, 'var(--chart-1)');
  assert.equal(rows[0].avgLikes, 10);
  assert.deepEqual(contentMixOf(rows), [
    { name: 'Reels', value: 3, color: 'var(--chart-1)' },
    { name: 'Videos', value: 1, color: 'var(--chart-4)' },
  ]);
});

test('chart rows map the analytics fields', () => {
  const posts = Array.from({ length: 10 }, (_, i) => ({ likeCount: i, commentsCount: i * 2 }));
  const top = topPostsChartOf(posts);
  assert.equal(top.length, 8);
  assert.deepEqual(top[1], { name: '#2', likes: 1, comments: 2 });
  assert.deepEqual(topPostsChartOf(undefined), []);
  assert.deepEqual(dayOfWeekDataOf([{ shortDay: 'Mon', posts: 2, avgEngagement: 5, avgLikes: 4, extra: 1 }]), [
    { name: 'Mon', posts: 2, avgEngagement: 5, avgLikes: 4 },
  ]);
  assert.deepEqual(timelineDataOf([{ month: 'Jan', posts: 1, likes: 2, comments: 3, avgLikes: 2 }]), [
    { name: 'Jan', posts: 1, likes: 2, comments: 3, avgLikes: 2 },
  ]);
});

test('empty analytics give empty charts', () => {
  assert.deepEqual(instagramChartsOf({}), {
    typeRows: [], contentMix: [], topPosts: [], dayOfWeek: [], timeline: [], caption: [],
  });
});

test('follower ratio guards against zero', () => {
  assert.equal(followerRatio({ followersCount: 300, followsCount: 120 }), '2.5');
  assert.equal(followerRatio({ followersCount: 300, followsCount: 0 }), '300.0');
  assert.equal(followerRatio({ followersCount: 0, followsCount: 10 }), '0');
});

test('views show only when Instagram reported them', () => {
  assert.equal(typeViewsSubtitle(typeStats.reel), '4.5K views, 1.5K on average');
  assert.equal(typeViewsSubtitle({}), 'No views reported');
  assert.equal(reportedViews(typeStats.reel, 'avgViews'), '1.5K');
  assert.equal(reportedViews(typeStats.video, 'totalViews'), '-');
});
