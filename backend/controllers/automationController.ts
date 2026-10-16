import { controller, inBackground, pathParam, servicesFor } from './http.ts';
import { jsonBody, queryParams } from '../middleware/validate.ts';
import {
    parseActivityQuery, parseAutomationAccount, parseAutomationRule, parseAutomationRuleUpdate, parseAutomationTest, parseStatsQuery,
} from '../validators/automationValidators.ts';
import type { SuccessMessageResponse } from '../../shared/types/domain.ts';
import type {
    AutomationAccountResponse, AutomationActivityItemResponse, AutomationActivityResponse, AutomationOverviewResponse,
    AutomationRuleResponse, AutomationStatsResponse, AutomationTestResponse,
} from '../../shared/types/automation.ts';

export const getAutomations = controller.createHandlers(async c => {
    const overview = await servicesFor(c).automations.overview(c.get('userId'));
    return c.json({ success: true, ...overview } satisfies AutomationOverviewResponse);
});

export const createAutomationRule = controller.createHandlers(jsonBody(parseAutomationRule), async c => {
    const rule = await servicesFor(c).automations.createRule(c.get('userId'), c.req.valid('json'));
    return c.json({ success: true, rule } satisfies AutomationRuleResponse);
});

export const updateAutomationRule = controller.createHandlers(jsonBody(parseAutomationRuleUpdate), async c => {
    const rule = await servicesFor(c).automations.updateRule(c.get('userId'), pathParam(c, 'id'), c.req.valid('json'));
    return c.json({ success: true, rule } satisfies AutomationRuleResponse);
});

export const duplicateAutomationRule = controller.createHandlers(async c => {
    const rule = await servicesFor(c).automations.duplicateRule(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true, rule } satisfies AutomationRuleResponse);
});

export const deleteAutomationRule = controller.createHandlers(async c => {
    await servicesFor(c).automations.deleteRule(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true, message: 'Automation rule deleted' } satisfies SuccessMessageResponse);
});

// matches a sample comment against a draft rule; nothing is stored or sent
export const testAutomationRule = controller.createHandlers(jsonBody(parseAutomationTest), async c => {
    const result = servicesFor(c).automations.test(c.req.valid('json'));
    return c.json({ success: true, ...result } satisfies AutomationTestResponse);
});

export const listAutomationActivity = controller.createHandlers(queryParams(parseActivityQuery), async c => {
    const page = await servicesFor(c).automations.activity(c.get('userId'), c.req.valid('query'));
    return c.json({ success: true, ...page } satisfies AutomationActivityResponse);
});

export const getAutomationStats = controller.createHandlers(queryParams(parseStatsQuery), async c => {
    const period = await servicesFor(c).automations.stats(c.get('userId'), c.req.valid('query'));
    return c.json({ success: true, ...period } satisfies AutomationStatsResponse);
});

// the item goes back in the queue and this request starts sending it, instead of waiting for the next sweep
export const retryAutomationActivity = controller.createHandlers(async c => {
    const item = await servicesFor(c).automations.retry(c.get('userId'), pathParam(c, 'id'));
    inBackground(c, 'automation retry', services => services.automationProcessor.run({ ids: [item.id] }));
    return c.json({ success: true, item } satisfies AutomationActivityItemResponse);
});

export const updateAutomationAccount = controller.createHandlers(jsonBody(parseAutomationAccount), async c => {
    const account = await servicesFor(c).automations.setPaused(c.get('userId'), pathParam(c, 'accountId'), c.req.valid('json').paused);
    return c.json({ success: true, account } satisfies AutomationAccountResponse);
});

export const subscribeAutomationAccount = controller.createHandlers(async c => {
    const account = await servicesFor(c).automations.subscribe(c.get('userId'), pathParam(c, 'accountId'));
    return c.json({ success: true, account } satisfies AutomationAccountResponse);
});
