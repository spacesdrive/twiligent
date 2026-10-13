import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeAccountMedia, typeTotalsOf, viewTotalsOf, filterAndSortMedia, typeViewsSubtitle, reelsDescription,
} from '../../../../src/features/analytics/reels/reelsLibrary.ts';

const accounts = [{ id: 'i1', title: 'Paper Fold' }, { id: 'i2', username: 'second' }, { id: 'i3' }];

test('media from every fulfilled account is merged with its account', () => {
  const results = [
    { status: 'fulfilled', value: { media: [{ id: 'm1', viewCount: 200, likeCount: 10, commentsCount: 10 }] } },
    { status: 'rejected', reason: new Error('token expired') },
    { status: 'fulfilled', value: { media: [{ id: 'm2', viewCount: 0 }] } },
  ];
  const media = mergeAccountMedia(accounts, results);
  assert.deepEqual(media.map(item => [item.id, item.accountId, item.accountTitle]), [
    ['m1', 'i1', 'Paper Fold'],
    ['m2', 'i3', 'Unknown account'],
  ]);
  assert.equal(media[0].engagementRate, 10);
  assert.equal(media[1].engagementRate, null);
  assert.deepEqual(mergeAccountMedia(accounts, [{ status: 'fulfilled', value: {} }]), []);
});

const media = [
  { id: 'r1', contentType: 'reel', viewCount: 1000, likeCount: 50, caption: 'Folding a crane', timestamp: '2026-03-01T00:00:00Z' },
  { id: 'p1', contentType: 'post', likeCount: 5000, caption: 'Paper stack', timestamp: '2026-05-01T00:00:00Z' },
  { id: 'x1', contentType: 'carousel', viewCount: 10, likeCount: 2, timestamp: 'not a date' },
];

test('type totals count unknown types as posts and only reported views', () => {
  const totals = typeTotalsOf(media);
  assert.deepEqual(totals.reel, { count: 1, views: 1000, viewsReported: 1 });
  assert.deepEqual(totals.post, { count: 2, views: 10, viewsReported: 1 });
  assert.deepEqual(totals.video, { count: 0, views: 0, viewsReported: 0 });
  assert.deepEqual(viewTotalsOf(totals), { totalViews: 1010, viewsReported: 2 });
});

test('media filters by type, caption and like range', () => {
  const base = { typeFilter: 'all', search: '', tier: 'all', sortField: 'viewCount' };
  assert.deepEqual(filterAndSortMedia(media, { ...base, typeFilter: 'reel' }).map(item => item.id), ['r1']);
  assert.deepEqual(filterAndSortMedia(media, { ...base, search: 'paper' }).map(item => item.id), ['p1']);
  assert.deepEqual(filterAndSortMedia(media, { ...base, tier: 'medium' }).map(item => item.id), ['p1']);
});

test('media sorts with missing values last', () => {
  const base = { typeFilter: 'all', search: '', tier: 'all' };
  assert.deepEqual(filterAndSortMedia(media, { ...base, sortField: 'viewCount' }).map(item => item.id), ['r1', 'x1', 'p1']);
  assert.deepEqual(filterAndSortMedia(media, { ...base, sortField: 'timestamp' }).map(item => item.id), ['p1', 'r1', 'x1']);
});

test('labels', () => {
  assert.equal(typeViewsSubtitle({ views: 1500, viewsReported: 2 }), '1.5K views');
  assert.equal(typeViewsSubtitle({ views: 0, viewsReported: 0 }), 'No views reported');
  assert.equal(reelsDescription(true, 5, 1), 'Loading content from your accounts');
  assert.equal(reelsDescription(false, 1, 1), '1 item across 1 account');
  assert.equal(reelsDescription(false, 2, 3), '2 items across 3 accounts');
});
