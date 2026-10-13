import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TESTER_HINT, instagramErrorMessage, readOAuthReturn, accountMetrics, accountCardHandle, visibleSections,
} from '../../../src/features/accounts/accountManagerData.js';

const params = query => new URLSearchParams(query);

test('known Instagram errors have their own message', () => {
  assert.equal(instagramErrorMessage('already_added'), 'This Instagram account is already connected.');
  assert.ok(instagramErrorMessage('access_denied').endsWith(TESTER_HINT));
});

test('unknown Instagram errors name the code and add the tester hint', () => {
  assert.equal(instagramErrorMessage('weird'), `Instagram connection failed: weird. ${TESTER_HINT}`);
});

test('a return without OAuth or add parameters does nothing', () => {
  assert.equal(readOAuthReturn(params('')), null);
  assert.equal(readOAuthReturn(params('ig_error=&add=')), null);
});

test('a successful connection is reported without an error', () => {
  assert.deepEqual(readOAuthReturn(params('ig_connected=true')), { connected: true, errorMessage: null, openAdd: false });
});

test('connected values other than true are dropped silently', () => {
  assert.deepEqual(readOAuthReturn(params('ig_connected=false')), { connected: false, errorMessage: null, openAdd: false });
});

test('errors and the add flag are read together', () => {
  const result = readOAuthReturn(params('ig_error=cancelled&add=1'));
  assert.equal(result.connected, false);
  assert.equal(result.errorMessage, 'Instagram sign-in was cancelled. Try again when you are ready.');
  assert.equal(result.openAdd, true);
});

test('each platform card shows its own three metrics', () => {
  assert.deepEqual(accountMetrics('youtube', { subscriberCount: 1, viewCount: 2, videoCount: 3 }), [['Subscribers', 1], ['Views', 2], ['Videos', 3]]);
  assert.deepEqual(accountMetrics('instagram', { followersCount: 4 }).map(([label]) => label), ['Followers', 'Following', 'Posts']);
  assert.deepEqual(accountMetrics('reddit', { totalKarma: 9 })[0], ['Karma', 9]);
});

test('card handles use u/ for Reddit and the platform handle otherwise', () => {
  assert.equal(accountCardHandle({ username: 'ribbon' }, 'reddit'), 'u/ribbon');
  assert.equal(accountCardHandle({}, 'reddit'), 'u/');
  assert.equal(accountCardHandle({ customUrl: '@dusk' }, 'youtube'), '@dusk');
});

test('only platforms with accounts get a section, in a fixed order', () => {
  const groups = { youtube: [], instagram: [{ id: 1 }], reddit: [{ id: 2 }] };
  assert.deepEqual(visibleSections(groups).map(section => section.key), ['instagram', 'reddit']);
});
