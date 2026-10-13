import { Hono } from 'hono';
import { getInstagramAuthUrl } from '../controllers/instagramAuthController.ts';
import type { AppEnv } from '../types/app.ts';

const router = new Hono<AppEnv>();

router.get('/auth/instagram/url', ...getInstagramAuthUrl);

export default router;
