import { Hono } from 'hono';
import {
    getCloudinaryConfig, getPublishingLimit, createContainer, getContainerStatus, publishContainer,
} from '../controllers/publishingController.ts';
import type { AppEnv } from '../types/app.ts';

const router = new Hono<AppEnv>();

router.get('/cloudinary-config', ...getCloudinaryConfig);
router.get('/accounts/:id/ig-publishing-limit', ...getPublishingLimit);
router.post('/accounts/:id/ig-publish', ...createContainer);
router.get('/ig-container/:containerId/status', ...getContainerStatus);
router.post('/accounts/:id/ig-media-publish', ...publishContainer);

export default router;
