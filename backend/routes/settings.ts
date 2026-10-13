import { Hono } from 'hono';
import { getSettings, saveSettings } from '../lib/db.ts';
import type { AppEnv } from '../types/app.ts';
import type { GitHubSettingsRequest, GitHubSettingsResponse, SuccessResponse } from '../../shared/types/domain.ts';

const app = new Hono<AppEnv>();

app.get('/settings/github', async (c) => {
    const settings = await getSettings(c.get('supabase'), c.get('userId'));
    const github = (settings.github || {}) as GitHubSettingsRequest;
    return c.json({
        repoOwner: github.repoOwner || '',
        repoName: github.repoName || '',
        branch: github.branch || 'main',
    } satisfies GitHubSettingsResponse);
});

// rewrites settings.github whole, so a token saved by older versions is dropped
app.put('/settings/github', async (c) => {
    const supabase = c.get('supabase');
    const userId = c.get('userId');
    const { repoOwner, repoName, branch } = await c.req.json() as GitHubSettingsRequest;

    const current = await getSettings(supabase, userId);
    const github: GitHubSettingsResponse = { repoOwner: repoOwner || '', repoName: repoName || '', branch: branch || 'main' };
    await saveSettings(supabase, { ...current, github }, userId);
    return c.json({ success: true } satisfies SuccessResponse);
});

export default app;
