import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadServerSettings, githubSettingsPayload, healthCheckResult, healthCheckFailure,
} from '../../../src/features/settings/settingsData.ts';
import type { ServerSettingsClient } from '../../../src/features/settings/settingsData.ts';
import type { GitHubSettingsResponse, KeysStatusResponse } from '../../../../shared/types/domain.ts';

interface FakeApiOptions {
  keys?: unknown[];
  github: unknown;
}

function fakeApi({ keys = [], github }: FakeApiOptions) {
  const calls: string[] = [];
  const queue = [...keys];
  return {
    calls,
    getKeys: async () => {
      calls.push('getKeys');
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return next as KeysStatusResponse;
    },
    getGithubSettings: async () => {
      calls.push('getGithubSettings');
      if (github instanceof Error) throw github;
      return github as GitHubSettingsResponse;
    },
  };
}

interface LoadState {
  keys: KeysStatusResponse[];
  github: { owner: string; name: string } | null;
  finished: boolean;
}

async function run(apiClient: ServerSettingsClient, { cancelled = false } = {}) {
  const state: LoadState = { keys: [], github: null, finished: false };
  await loadServerSettings(apiClient, {
    isCancelled: () => cancelled,
    applyKeys: keys => state.keys.push(keys),
    applyGithub: (owner, name) => { state.github = { owner, name }; },
    finish: () => { state.finished = true; },
  });
  return state;
}

test('loads keys and the saved repository together', async () => {
  const apiClient = fakeApi({ keys: [{ youtube: 1 }], github: { repoOwner: 'me', repoName: 'copy' } });
  const state = await run(apiClient);
  assert.deepEqual(apiClient.calls, ['getKeys', 'getGithubSettings']);
  assert.deepEqual(state, { keys: [{ youtube: 1 }], github: { owner: 'me', name: 'copy' }, finished: true });
});

test('missing repository fields become empty strings', async () => {
  const state = await run(fakeApi({ keys: [{}], github: {} }));
  assert.deepEqual(state.github, { owner: '', name: '' });
});

test('a failed GitHub request retries the keys alone', async () => {
  const apiClient = fakeApi({ keys: [{ first: true }, { second: true }], github: new Error('down') });
  const state = await run(apiClient);
  assert.deepEqual(apiClient.calls, ['getKeys', 'getGithubSettings', 'getKeys']);
  assert.deepEqual(state.keys, [{ second: true }]);
  assert.equal(state.github, null);
  assert.equal(state.finished, true);
});

test('an empty GitHub answer keeps the keys already applied when the retry fails', async () => {
  const state = await run(fakeApi({ keys: [{ first: true }, new Error('down')], github: null }));
  assert.deepEqual(state.keys, [{ first: true }]);
  assert.equal(state.github, null);
  assert.equal(state.finished, true);
});

test('when both attempts fail the page still finishes loading', async () => {
  const state = await run(fakeApi({ keys: [new Error('a'), new Error('b')], github: {} }));
  assert.deepEqual(state, { keys: [], github: null, finished: true });
});

test('a cancelled load applies nothing', async () => {
  const state = await run(fakeApi({ keys: [{}], github: {} }), { cancelled: true });
  assert.deepEqual(state, { keys: [], github: null, finished: false });
});

test('the saved repository is trimmed and defaults to twiligent', () => {
  assert.deepEqual(githubSettingsPayload(' me ', ''), { repoOwner: 'me', repoName: 'twiligent', branch: 'main' });
  assert.deepEqual(githubSettingsPayload('me', ' copy '), { repoOwner: 'me', repoName: 'copy', branch: 'main' });
});

test('health results explain what to check', () => {
  assert.deepEqual(healthCheckResult({ status: 'ok' }), { success: true, message: 'The API is reachable and healthy.' });
  assert.equal(healthCheckResult({ status: 'degraded' }).message, 'The API answered with status "degraded". Check the Worker logs.');
  assert.equal(healthCheckFailure(new Error('timeout')).success, false);
  assert.ok(healthCheckFailure(new Error('timeout')).message.startsWith('The API could not be reached: timeout.'));
});
