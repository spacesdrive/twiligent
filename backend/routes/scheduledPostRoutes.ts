import { Hono } from 'hono';
import {
    listScheduledPosts, createScheduledPost, updateScheduledPost, deleteAllScheduledPosts, deleteScheduledPost, publishDuePosts,
} from '../controllers/scheduledPostController.ts';
import type { AppEnv } from '../types/app.ts';

const router = new Hono<AppEnv>();

router.get('/scheduled-posts', ...listScheduledPosts);
router.post('/scheduled-posts', ...createScheduledPost);
router.put('/scheduled-posts/:id', ...updateScheduledPost);
router.delete('/scheduled-posts', ...deleteAllScheduledPosts);
router.delete('/scheduled-posts/:id', ...deleteScheduledPost);
// the manual trigger for the scheduler; api.processScheduled() calls the GET form
router.get('/process-scheduled', ...publishDuePosts);
router.post('/process-scheduled', ...publishDuePosts);

export default router;
