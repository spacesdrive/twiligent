import { Hono } from 'hono';
import { listMedia, registerMedia } from '../controllers/mediaController.ts';
import type { AppEnv } from '../types/app.ts';

// each person's media library on the instance's Cloudinary account
const router = new Hono<AppEnv>();

router.get('/media', ...listMedia);
router.post('/media', ...registerMedia);

export default router;
