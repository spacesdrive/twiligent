import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATE_DISPLAY, anyActive, composerProblem, parseTags, readYouTubeReturn, uploadPercent, youtubeReturnError,
} from '../../../src/features/youtube/youtubeUploadData.ts';
import type { ComposerValues } from '../../../src/features/youtube/youtubeUploadData.ts';

const NOW = new Date('2026-11-05T12:00:00Z');
const READY: ComposerValues = { connectionId: 'c1', hasVideo: true, title: 'Launch', madeForKids: false, scheduled: false, publishAt: '' };

test('every state has a word, a tone and a line of help, so status is never shown by colour alone', () => {
  for (const display of Object.values(STATE_DISPLAY)) {
    assert.ok(display.label.length > 0);
    assert.ok(display.help.length > 0);
  }
  assert.equal(anyActive([{ state: 'done' }, { state: 'failed' }]), false);
  assert.equal(anyActive([{ state: 'done' }, { state: 'uploading' }]), true);
});

test('progress is the share of bytes YouTube confirmed', () => {
  assert.equal(uploadPercent({ bytesConfirmed: 25, sourceBytes: 100 }), 25);
  assert.equal(uploadPercent({ bytesConfirmed: 0, sourceBytes: 0 }), 0);
  assert.equal(uploadPercent({ bytesConfirmed: 150, sourceBytes: 100 }), 100);
});

test('tags may be split by commas or lines, and repeats are dropped', () => {
  assert.deepEqual(parseTags('launch, news\nlaunch,  ,day one'), ['launch', 'news', 'day one']);
});

test('the composer names the first missing field, including YouTube\'s required kids answer', () => {
  assert.equal(composerProblem(READY, NOW), null);
  assert.equal(composerProblem({ ...READY, connectionId: '' }, NOW)?.field, 'connection');
  assert.equal(composerProblem({ ...READY, hasVideo: false }, NOW)?.field, 'video');
  assert.equal(composerProblem({ ...READY, title: 'x'.repeat(101) }, NOW)?.field, 'title');
  assert.equal(composerProblem({ ...READY, title: 'a <b>' }, NOW)?.field, 'title');
  assert.equal(composerProblem({ ...READY, madeForKids: null }, NOW)?.field, 'madeForKids');
  assert.equal(composerProblem({ ...READY, scheduled: true, publishAt: '2026-11-05T11:00' }, NOW)?.message, 'Pick a time in the future.');
  assert.equal(composerProblem({ ...READY, scheduled: true, publishAt: '2026-11-06T11:00' }, NOW), null);
});

test('the sign-in return is read from the fragment, and errors from the query', () => {
  assert.deepEqual(readYouTubeReturn('#yt_code=abc&yt_state=s1'), { code: 'abc', state: 's1' });
  assert.equal(readYouTubeReturn('#ig_code=abc'), null);
  assert.match(youtubeReturnError(new URLSearchParams('yt_error=access_denied')) ?? '', /cancelled/);
  assert.match(youtubeReturnError(new URLSearchParams('yt_error=weird')) ?? '', /weird/);
  assert.equal(youtubeReturnError(new URLSearchParams('')), null);
});
