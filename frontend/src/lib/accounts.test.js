import { test } from 'node:test';
import assert from 'node:assert/strict';
import { platformOf, accountPath, accountName, accountHandle, accountInitials, audienceOf, platformSummary } from './accounts.js';

const yt = { id: 'y1', title: 'Studio Dusk', customUrl: '@studiodusk', subscriberCount: 1200 };
const ig = { id: 'i1', platform: 'instagram', title: 'Paper Fold', username: 'paperfold', followersCount: 800 };
const rd = { id: 'r1', platform: 'reddit', username: 'ribbon', totalKarma: 50 };

test('accounts without a platform are YouTube channels', () => {
  assert.equal(platformOf(yt), 'youtube');
  assert.equal(platformOf(ig), 'instagram');
  assert.equal(platformOf(rd), 'reddit');
});

test('each platform routes to its own analytics page', () => {
  assert.equal(accountPath(yt), '/channel/y1');
  assert.equal(accountPath(ig), '/instagram/i1');
  assert.equal(accountPath(rd), '/reddit/r1');
});

test('names and handles follow each platform convention', () => {
  assert.equal(accountName(rd), 'u/ribbon');
  assert.equal(accountName(ig), 'Paper Fold');
  assert.equal(accountHandle(ig), '@paperfold');
  assert.equal(accountHandle(yt), '@studiodusk');
  assert.equal(accountHandle(rd), 'Reddit');
});

test('initials come from the title or username', () => {
  assert.equal(accountInitials(yt), 'ST');
  assert.equal(accountInitials({ title: 'u/ribbon' }), 'RI');
  assert.equal(accountInitials({}), '?');
});

test('audience uses subscribers, followers or karma', () => {
  assert.deepEqual([yt, ig, rd].map(audienceOf), [1200, 800, 50]);
});

test('the platform summary lists only platforms that have accounts', () => {
  assert.equal(platformSummary([yt, ig, { ...ig, id: 'i2' }]), '1 YouTube, 2 Instagram');
  assert.equal(platformSummary([]), '');
});
