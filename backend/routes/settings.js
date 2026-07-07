import { Hono } from 'hono';
import { getSettings, saveSettings } from '../lib/db.js';

const app = new Hono();

app.get('/settings/github', async (c) => {
    const supabase = c.get('supabase');
    const userId = c.get('userId');
    const settings = await getSettings(supabase, userId);
    const gh = settings.github || {};
    return c.json({
        configured: !!(gh.pat && gh.repoOwner && gh.repoName),
        repoOwner: gh.repoOwner || '',
        repoName: gh.repoName || '',
        branch: gh.branch || 'main',
        patSet: !!gh.pat,
    });
});

app.put('/settings/github', async (c) => {
    const supabase = c.get('supabase');
    const userId = c.get('userId');
    const { pat, repoOwner, repoName, branch } = await c.req.json();

    const current = await getSettings(supabase, userId);
    const update = { ...current, github: { pat, repoOwner, repoName, branch: branch || 'main' } };
    await saveSettings(supabase, update, userId);
    return c.json({ success: true });
});

export default app;
