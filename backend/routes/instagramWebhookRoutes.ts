import { Hono } from 'hono';
import { verifyInstagramWebhook, receiveInstagramWebhook } from '../controllers/instagramWebhookController.ts';
import { verifyMetaWebhook } from '../middleware/metaWebhook.ts';
import type { AppEnv } from '../types/app.ts';

const router = new Hono<AppEnv>();

// Meta's dashboard calls the GET once to check the callback URL; every notification is a signed POST
router.get('/webhooks/instagram', ...verifyInstagramWebhook);
router.post('/webhooks/instagram', verifyMetaWebhook, ...receiveInstagramWebhook);

export default router;
