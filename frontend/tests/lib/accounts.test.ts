import { test } from 'node:test';
import assert from 'node:assert/strict';
import { platformOf, accountPath, accountName, accountHandle, accountInitials, audienceOf, platformSummary } from '../../src/lib/accounts.ts';

const youtubeAccount = { id: 'y1', title: 'Studio Dusk', customUrl: '@studiodusk', subscriberCount: 1200 };
const instagramAccount = { id: 'i1', platform: 'instagram', title: 'Paper Fold', username: 'paperfold', followersCount: 800 };
const redditAccount = { id: 'r1', platform: 'reddit', username: 'ribbon', totalKarma: 50 };

test('accounts without a platform are YouTube channels', () => {
  assert.equal(platformOf(youtubeAccount), 'youtube');
  assert.equal(platformOf(instagramAccount), 'instagram');
  assert.equal(platformOf(redditAccount), 'reddit');
});

test('each platform routes to its own analytics page', () => {
  assert.equal(accountPath(youtubeAccount), '/channel/y1');
  assert.equal(accountPath(instagramAccount), '/instagram/i1');
  assert.equal(accountPath(redditAccount), '/reddit/r1');
});

test('names and handles follow each platform convention', () => {
  assert.equal(accountName(redditAccount), 'u/ribbon');
  assert.equal(accountName(instagramAccount), 'Paper Fold');
  assert.equal(accountHandle(instagramAccount), '@paperfold');
  assert.equal(accountHandle(youtubeAccount), '@studiodusk');
  assert.equal(accountHandle(redditAccount), 'Reddit');
});

test('initials come from the title or username', () => {
  assert.equal(accountInitials(youtubeAccount), 'ST');
  assert.equal(accountInitials({ title: 'u/ribbon' }), 'RI');
  assert.equal(accountInitials({}), '?');
});

test('audience uses subscribers, followers or karma', () => {
  assert.deepEqual([youtubeAccount, instagramAccount, redditAccount].map(audienceOf), [1200, 800, 50]);
});

test('the platform summary lists only platforms that have accounts', () => {
  assert.equal(platformSummary([youtubeAccount, instagramAccount, { ...instagramAccount, id: 'i2' }]), '1 YouTube, 2 Instagram');
  assert.equal(platformSummary([]), '');
});
