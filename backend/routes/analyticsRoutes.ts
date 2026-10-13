import { Hono } from 'hono';
import {
    getChannelAnalytics, getChannelVideos, getComparison, getVideoLibrary, getInstagramAnalytics, getInstagramMedia,
} from '../controllers/analyticsController.ts';
import type { AppEnv } from '../types/app.ts';

const router = new Hono<AppEnv>();

router.get('/accounts/:id/analytics', ...getChannelAnalytics);
router.get('/accounts/:id/videos', ...getChannelVideos);
router.get('/comparison', ...getComparison);
router.get('/videos/all', ...getVideoLibrary);
router.get('/accounts/:id/ig-analytics', ...getInstagramAnalytics);
router.get('/accounts/:id/ig-media', ...getInstagramMedia);

export default router;
