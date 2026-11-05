import { Hono } from 'hono';
import {
    cancelYouTubeUpload, completeYouTubeConnection, createYouTubeUpload, deleteYouTubeConnection, getYouTubeAuthUrl,
    listYouTubeConnections, listYouTubeUploads, retryYouTubeUpload, updateYouTubeUpload,
} from '../controllers/youtubeController.ts';
import type { AppEnv } from '../types/app.ts';

// YouTube publishing; the public callback is in routes/index.ts
const router = new Hono<AppEnv>();

router.get('/auth/youtube/url', ...getYouTubeAuthUrl);
router.post('/auth/youtube/complete', ...completeYouTubeConnection);
router.get('/youtube/connections', ...listYouTubeConnections);
router.delete('/youtube/connections/:id', ...deleteYouTubeConnection);
router.get('/youtube/uploads', ...listYouTubeUploads);
router.post('/youtube/uploads', ...createYouTubeUpload);
router.put('/youtube/uploads/:id', ...updateYouTubeUpload);
router.post('/youtube/uploads/:id/cancel', ...cancelYouTubeUpload);
router.post('/youtube/uploads/:id/retry', ...retryYouTubeUpload);

export default router;
