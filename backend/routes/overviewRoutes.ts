import { Hono } from 'hono';
import { getOverview } from '../controllers/overviewController.ts';
import type { AppEnv } from '../types/app.ts';

const router = new Hono<AppEnv>();

router.get('/overview', ...getOverview);

export default router;
