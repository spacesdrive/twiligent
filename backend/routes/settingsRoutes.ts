import { Hono } from 'hono';
import { getGithubSettings, saveGithubSettings, getKeyStatus } from '../controllers/settingsController.ts';
import type { AppEnv } from '../types/app.ts';

const router = new Hono<AppEnv>();

router.get('/settings/github', ...getGithubSettings);
router.put('/settings/github', ...saveGithubSettings);
router.get('/keys', ...getKeyStatus);

export default router;
