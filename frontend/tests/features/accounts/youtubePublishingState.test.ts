import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardPublishing, verifyReturnError } from '../../../src/features/accounts/youtubePublishingState.ts';
import type { YouTubeConnectionSummary } from '../../../../shared/types/youtubePublishing.ts';

const CHANNEL = { id: 'yt1', platform: 'youtube', channelId: 'UC1' };
const READY = { loading: false, failed: false, configured: true, connections: [] };

function connection(status: YouTubeConnectionSummary['status'], accountId: string | null = 'yt1'): YouTubeConnectionSummary {
  return { id: 'c1', channelId: 'UC1', channelTitle: 'Cooking', accountId, status, scopes: [], createdAt: '2026-11-05T00:00:00Z' };
}

test('a YouTube card shows whether its channel can publish, matched by account or by channel', () => {
  assert.deepEqual(cardPublishing(CHANNEL, READY), { kind: 'unverified' });
  assert.equal(cardPublishing(CHANNEL, { ...READY, connections: [connection('active')] }).kind, 'verified');
  assert.equal(cardPublishing(CHANNEL, { ...READY, connections: [connection('active', null)] }).kind, 'verified');
  assert.equal(cardPublishing(CHANNEL, { ...READY, connections: [connection('needs_reconnect')] }).kind, 'needs_sign_in');
  assert.equal(cardPublishing({ ...CHANNEL, channelId: 'UC2' }, { ...READY, connections: [connection('active', 'other')] }).kind, 'unverified');
});

test('cards stay quiet while the section explains why publishing is unavailable, and wait while it loads', () => {
  assert.deepEqual(cardPublishing(CHANNEL, { ...READY, loading: true }), { kind: 'loading' });
  assert.deepEqual(cardPublishing(CHANNEL, { ...READY, failed: true }), { kind: 'hidden' });
  assert.deepEqual(cardPublishing(CHANNEL, { ...READY, configured: false }), { kind: 'hidden' });
  assert.deepEqual(cardPublishing({ id: 'ig1', platform: 'instagram' }, READY), { kind: 'hidden' });
});

test('a failed return from Google says what failed and what to do', () => {
  assert.match(verifyReturnError(new URLSearchParams('yt_error=access_denied')) ?? '', /^Couldn't verify the channel\. .*cancelled/);
  assert.match(verifyReturnError(new URLSearchParams('yt_error=weird')) ?? '', /weird.*Choose Verify again/);
  assert.equal(verifyReturnError(new URLSearchParams('')), null);
});
