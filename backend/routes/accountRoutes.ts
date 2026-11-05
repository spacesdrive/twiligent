import { Hono } from 'hono';
import {
    listAccounts, resolveChannel, addYouTubeAccount, refreshAllAccounts, refreshAccount, deleteAccount,
} from '../controllers/accountController.ts';
import type { AppEnv } from '../types/app.ts';

const router = new Hono<AppEnv>();

router.get('/accounts', ...listAccounts);
router.post('/resolve-channel', ...resolveChannel);
router.post('/accounts', ...addYouTubeAccount);
router.post('/accounts/refresh-all', ...refreshAllAccounts);
router.post('/accounts/:id/refresh', ...refreshAccount);
router.delete('/accounts/:id', ...deleteAccount);

export default router;
