import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countLabel, overviewDescription, syncDetail, metricTabsOf, igTypeSummary, categoryMeta, topContentLabel,
  accountAudienceLabel, accountContentLabel,
} from './overviewLabels.js';

const channel = { id: 'y1', viewCount: 5000, videoCount: 10, subscriberCount: 100 };
const igAccount = { id: 'i1', platform: 'instagram', mediaCount: 20, followersCount: 300 };
const redditAccount = { id: 'r1', platform: 'reddit', totalKarma: 70, postKarma: 60 };

test('count labels pluralise every count except one', () => {
  assert.equal(countLabel(1, 'channel'), '1 channel');
  assert.equal(countLabel(0, 'channel'), '0 channels');
  assert.equal(countLabel(3, 'YouTube channel'), '3 YouTube channels');
});

test('header description summarises the accounts', () => {
  assert.equal(overviewDescription([]), 'Add your first account to start tracking.');
  assert.equal(overviewDescription([channel]), 'Tracking 1 account: 1 YouTube.');
  assert.equal(overviewDescription([channel, igAccount]), 'Tracking 2 accounts: 1 YouTube, 1 Instagram.');
});

test('sync detail prefers the syncing label', () => {
  assert.equal(syncDetail(true, 5), 'Syncing analytics');
  assert.equal(syncDetail(false, 5), 'Across all platforms');
  assert.equal(syncDetail(false, 0), 'Open an analytics page to load');
});

test('metric tabs list present parts or a fallback', () => {
  const stats = {
    totals: { subscribers: 1500, followers: 0, karma: 20, views: 0, videos: 3, posts: 0 },
    cacheTotals: { igViews: 0, rdPosts: 0 },
    trackedStats: { total: 2 },
    summary: { totalAudience: 1520, totalViews: 0, trackedViewTotal: 0, totalContent: 5, totalComments: 0, totalLikes: 9 },
  };
  const tabs = metricTabsOf([channel, redditAccount], stats, false);
  assert.deepEqual(tabs.map(tab => tab.value), ['audience', 'views', 'content', 'accounts', 'comments', 'likes']);
  assert.equal(tabs[0].figure, '1.5K');
  assert.equal(tabs[0].detail, '1.5K subscribers, 20 karma');
  assert.equal(tabs[1].detail, 'No views recorded yet');
  assert.equal(tabs[2].detail, '3 videos, 2 tracked');
  assert.equal(tabs[3].figure, 2);
  assert.equal(tabs[3].detail, '1 YouTube, 1 Reddit');
  assert.equal(tabs[4].detail, 'Open an analytics page to load');
  assert.equal(tabs[5].detail, 'Across all platforms');
});

test('Instagram type summary lists every content type', () => {
  const igTypes = { reel: { count: 2, views: 1200 }, post: { count: 1, views: 0 }, video: { count: 0, views: 0 } };
  assert.equal(igTypeSummary(igTypes, 'views'), '1.2K reels, 0 posts, 0 videos');
  assert.equal(igTypeSummary(igTypes, 'count'), '2 reels, 1 posts, 0 videos');
});

test('category meta skips empty platforms', () => {
  assert.equal(categoryMeta({ count: 1, ytCount: 1, rdCount: 0 }), '1 item, 1 YouTube');
  assert.equal(categoryMeta({ count: 3, ytCount: 1, rdCount: 2 }), '3 items, 1 YouTube, 2 Reddit');
});

test('row labels follow the account platform', () => {
  assert.equal(topContentLabel(channel), '5.0K views');
  assert.equal(topContentLabel(igAccount), '20 items');
  assert.equal(topContentLabel(redditAccount), '70 karma');
  assert.equal(accountAudienceLabel(channel), '100 subscribers');
  assert.equal(accountAudienceLabel(igAccount), '300 followers');
  assert.equal(accountAudienceLabel(redditAccount), '70 karma');
  assert.equal(accountContentLabel(channel), '5.0K views, 10 videos');
  assert.equal(accountContentLabel(igAccount), '20 items');
  assert.equal(accountContentLabel(redditAccount), '60 post karma');
});
