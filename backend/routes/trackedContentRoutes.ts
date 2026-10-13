import { Hono } from 'hono';
import {
    listTrackedContent, addTrackedContent, updateTrackedContent, deleteTrackedContent, refreshTrackedContent,
} from '../controllers/trackedContentController.ts';
import type { AppEnv } from '../types/app.ts';

const router = new Hono<AppEnv>();

router.get('/tracked-content', ...listTrackedContent);
router.post('/tracked-content', ...addTrackedContent);
router.put('/tracked-content/:id', ...updateTrackedContent);
router.delete('/tracked-content/:id', ...deleteTrackedContent);
router.post('/tracked-content/:id/refresh', ...refreshTrackedContent);

export default router;
