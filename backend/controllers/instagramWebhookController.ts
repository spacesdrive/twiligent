import { controller, inBackground, servicesFor } from './http.ts';
import { jsonBody, queryParams } from '../middleware/validate.ts';
import { parseWebhookVerification } from '../validators/automationValidators.ts';
import { parseInstagramWebhook } from '../validators/instagramWebhookValidators.ts';
import { FREE_PLAN_SUBREQUESTS, REQUEST_SUBREQUESTS } from '../lib/automationDelivery.ts';

// called by Meta when the webhook is saved in its dashboard; the answer is the bare challenge, not JSON
export const verifyInstagramWebhook = controller.createHandlers(queryParams(parseWebhookVerification), async c => {
    const challenge = await servicesFor(c).automationWebhook.challengeAnswer(c.req.valid('query'));
    return c.text(challenge);
});

// called by Meta, not a browser: verifyMetaWebhook has already checked the signature. Comments and answers are stored
// before the 200, so Meta keeps retrying for 36 hours if storing fails; the messages go out after the response
export const receiveInstagramWebhook = controller.createHandlers(jsonBody(body => parseInstagramWebhook(body)), async c => {
    const { queuedIds, followupIds, subrequests } = await servicesFor(c).automationWebhook.ingest(c.req.valid('json'));
    // the sends share this invocation's subrequests with the intake and the middleware before it
    const left = FREE_PLAN_SUBREQUESTS - REQUEST_SUBREQUESTS - subrequests;
    if (queuedIds.length > 0 || followupIds.length > 0) {
        inBackground(c, 'automation replies', async services => {
            const replies = queuedIds.length > 0 ? await services.automationProcessor.run({ ids: queuedIds, subrequests: left }) : null;
            if (followupIds.length > 0) await services.automationFollowups.run({ ids: followupIds, subrequests: left - (replies?.subrequests ?? 0) });
        });
    }
    return c.json({ success: true });
});
