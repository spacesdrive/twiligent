import { Hono } from 'hono';
import { getRedditAnalytics, getRedditPosts } from '../controllers/redditController.ts';
import type { AppEnv } from '../types/app.ts';

const router = new Hono<AppEnv>();

router.get('/accounts/:id/reddit-analytics', ...getRedditAnalytics);
router.get('/accounts/:id/reddit-posts', ...getRedditPosts);

export default router;
