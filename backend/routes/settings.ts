import { Hono } from 'hono';
import { getSettings, saveSettings } from '../lib/db.ts';
import type { AppEnv } from '../types/app.ts';
import type { GitHubSettingsRequest, GitHubSettingsResponse, SuccessResponse } from '../../shared/types/domain.ts';

const app = new Hono<AppEnv>();

app.get('/settings/github', async (c) => {
    const supabase = c.get('supabase');
    const userId = c.get('userId');
    const settings = await getSettings(supabase, userId);
    const github = (settings.github || {}) as GitHubSettingsRequest;
    return c.json({
        configured: !!(github.pat && github.repoOwner && github.repoName),
        repoOwner: github.repoOwner || '',
        repoName: github.repoName || '',
        branch: github.branch || 'main',
        patSet: !!github.pat,
    } satisfies GitHubSettingsResponse);
});

app.put('/settings/github', async (c) => {
    const supabase = c.get('supabase');
    const userId = c.get('userId');
    const { pat, repoOwner, repoName, branch } = await c.req.json() as GitHubSettingsRequest;

    const current = await getSettings(supabase, userId);
    const update = { ...current, github: { pat, repoOwner, repoName, branch: branch || 'main' } };
    await saveSettings(supabase, update, userId);
    return c.json({ success: true } satisfies SuccessResponse);
});

export default app;
