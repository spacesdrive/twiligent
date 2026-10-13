import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import settingsRouter from '../../routes/settingsRoutes.ts';
import { fakeSupabase, tableRow } from '../fixtures/fakeSupabase.ts';
import { mountWithContext, callRoute } from '../fixtures/routeHarness.ts';

function settingsRow(value: Record<string, unknown>) {
    return tableRow('settings', { user_id: 'user-1', key: 'api_keys', value });
}

describe('GitHub settings routes', () => {
    test('reports the stored repository and never a token', async () => {
        const supabase = fakeSupabase([settingsRow({ github: { pat: 'OLDTOKEN', repoOwner: 'me', repoName: 'twiligent', branch: 'dev' } })]);
        const app = mountWithContext(app => app.route('/', settingsRouter), { supabase, userId: 'user-1' });
        const response = await callRoute(app, 'GET', '/settings/github');
        assert.deepEqual(JSON.parse(response.body), { repoOwner: 'me', repoName: 'twiligent', branch: 'dev' });
    });

    test('saving the repository keeps other settings and drops an old token', async () => {
        const supabase = fakeSupabase([settingsRow({ other: 1, github: { pat: 'OLDTOKEN', repoOwner: 'old', repoName: 'repo' } })]);
        const app = mountWithContext(app => app.route('/', settingsRouter), { supabase, userId: 'user-1' });
        const saved = await callRoute(app, 'PUT', '/settings/github', { json: { repoOwner: 'me', repoName: 'twiligent' } });
        assert.deepEqual(JSON.parse(saved.body), { success: true });

        assert.deepEqual(supabase.table[0].value, { other: 1, github: { repoOwner: 'me', repoName: 'twiligent', branch: 'main' } });
        const response = await callRoute(app, 'GET', '/settings/github');
        assert.deepEqual(JSON.parse(response.body), { repoOwner: 'me', repoName: 'twiligent', branch: 'main' });
    });

    test('a user without settings gets empty values', async () => {
        const app = mountWithContext(app => app.route('/', settingsRouter), { supabase: fakeSupabase([]), userId: 'user-1' });
        const response = await callRoute(app, 'GET', '/settings/github');
        assert.deepEqual(JSON.parse(response.body), { repoOwner: '', repoName: '', branch: 'main' });
    });
});
