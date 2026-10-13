import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROGRESS_KEY, readProgress, saveProgress, completedSteps, repoBaseUrl } from '../../../src/features/settings/schedulingProgress.ts';

function fakeStorage(initial = {}) {
  const items = { ...initial };
  return {
    items,
    getItem: key => (key in items ? items[key] : null),
    setItem: (key, value) => { items[key] = String(value); },
  };
}

const throwingStorage = {
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('quota'); },
};

test('saved progress is read back', () => {
  const storage = fakeStorage({ [PROGRESS_KEY]: '{"fork":true}' });
  assert.deepEqual(readProgress(() => storage), { fork: true });
});

test('missing, null or broken progress reads as nothing done', () => {
  assert.deepEqual(readProgress(() => fakeStorage()), {});
  assert.deepEqual(readProgress(() => fakeStorage({ [PROGRESS_KEY]: 'null' })), {});
  assert.deepEqual(readProgress(() => fakeStorage({ [PROGRESS_KEY]: '{oops' })), {});
});

test('blocked storage reads as nothing done', () => {
  assert.deepEqual(readProgress(() => throwingStorage), {});
  assert.deepEqual(readProgress(() => { throw new Error('SecurityError'); }), {});
});

test('progress is saved as JSON under one key', () => {
  const storage = fakeStorage();
  saveProgress(() => storage, { fork: true, test: false });
  assert.equal(storage.items[PROGRESS_KEY], '{"fork":true,"test":false}');
});

test('saving to blocked storage is silent', () => {
  assert.doesNotThrow(() => saveProgress(() => throwingStorage, { fork: true }));
  assert.doesNotThrow(() => saveProgress(() => { throw new Error('SecurityError'); }, {}));
});

test('only the five setup steps count as completed', () => {
  assert.equal(completedSteps({}), 0);
  assert.equal(completedSteps({ fork: true, supabase: false, test: true, other: true }), 2);
});

test('repository links need a username and default to twiligent', () => {
  assert.equal(repoBaseUrl('  ', 'x'), null);
  assert.equal(repoBaseUrl(' me ', ''), 'https://github.com/me/twiligent');
  assert.equal(repoBaseUrl('me', ' copy '), 'https://github.com/me/copy');
});
