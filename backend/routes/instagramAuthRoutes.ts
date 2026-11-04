import { Hono } from 'hono';
import { completeInstagramConnection, getInstagramAuthUrl } from '../controllers/instagramAuthController.ts';
import type { AppEnv } from '../types/app.ts';

const router = new Hono<AppEnv>();

router.get('/auth/instagram/url', ...getInstagramAuthUrl);
router.post('/auth/instagram/complete', ...completeInstagramConnection);

export default router;
