import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLOUDINARY_LOADING, nextCloudinaryState } from '../../src/lib/cloudinaryConfigState.ts';

const CONFIG = { success: true as const, cloudName: 'demo', uploadPreset: 'unsigned' };

test('the config starts loading with no error, so nothing claims the server lacks Cloudinary yet', () => {
  assert.deepEqual(CLOUDINARY_LOADING, { config: null, loading: true, error: null });
});

test('a loaded config is ready, and a failed first load keeps the reason to show', () => {
  assert.deepEqual(nextCloudinaryState(CLOUDINARY_LOADING, { ok: true, config: CONFIG }), { config: CONFIG, loading: false, error: null });
  assert.deepEqual(nextCloudinaryState(CLOUDINARY_LOADING, { ok: false, message: 'Network error' }), { config: null, loading: false, error: 'Network error' });
});

test('a failed refetch keeps the config already loaded, and a later success clears an earlier error', () => {
  const ready = { config: CONFIG, loading: true, error: null };
  assert.deepEqual(nextCloudinaryState(ready, { ok: false, message: 'Network error' }), { config: CONFIG, loading: false, error: null });
  assert.deepEqual(nextCloudinaryState({ config: null, loading: true, error: 'Network error' }, { ok: true, config: CONFIG }), { config: CONFIG, loading: false, error: null });
});
