import { Hono } from 'hono';
import {
    getAutomations, createAutomationRule, updateAutomationRule, duplicateAutomationRule, deleteAutomationRule, testAutomationRule,
    listAutomationActivity, getAutomationStats, retryAutomationActivity, updateAutomationAccount, subscribeAutomationAccount,
} from '../controllers/automationController.ts';
import type { AppEnv } from '../types/app.ts';

const router = new Hono<AppEnv>();

router.get('/automations', ...getAutomations);
router.post('/automations/rules', ...createAutomationRule);
router.put('/automations/rules/:id', ...updateAutomationRule);
router.delete('/automations/rules/:id', ...deleteAutomationRule);
router.post('/automations/rules/:id/duplicate', ...duplicateAutomationRule);
router.post('/automations/test', ...testAutomationRule);
router.get('/automations/activity', ...listAutomationActivity);
router.post('/automations/activity/:id/retry', ...retryAutomationActivity);
router.get('/automations/stats', ...getAutomationStats);
router.put('/automations/accounts/:accountId', ...updateAutomationAccount);
router.post('/automations/accounts/:accountId/subscribe', ...subscribeAutomationAccount);

export default router;
