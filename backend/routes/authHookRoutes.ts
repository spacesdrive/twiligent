import { Hono } from 'hono';
import { sendAuthEmail } from '../controllers/authHookController.ts';
import { verifyAuthHook } from '../middleware/authHook.ts';
import { authHookErrorHandler } from '../middleware/errorHandler.ts';
import type { AppEnv } from '../types/app.ts';

const router = new Hono<AppEnv>();

// Supabase Auth reads failures in its own shape, so this table answers errors with the hook error handler
router.onError(authHookErrorHandler);

router.post('/auth/email-hook', verifyAuthHook, ...sendAuthEmail);

export default router;
