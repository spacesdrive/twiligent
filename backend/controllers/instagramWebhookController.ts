import { controller, inBackground, servicesFor } from './http.ts';
import { jsonBody, queryParams } from '../middleware/validate.ts';
import { parseWebhookVerification } from '../validators/automationValidators.ts';
import { parseInstagramWebhook } from '../validators/instagramWebhookValidators.ts';
import { BACKGROUND_RUN_MS, FREE_PLAN_SUBREQUESTS, REQUEST_SUBREQUESTS } from '../lib/automationDelivery.ts';

// called by Meta when the webhook is saved in its dashboard; the answer is the bare challenge, not JSON
export const verifyInstagramWebhook = controller.createHandlers(queryParams(parseWebhookVerification), async c => {
    const challenge = await servicesFor(c).automationWebhook.challengeAnswer(c.req.valid('query'));
    return c.text(challenge);
});

// called by Meta, not a browser: verifyMetaWebhook has already checked the signature. Comments and answers are stored
// before the 200, so Meta keeps retrying for 36 hours if storing fails; the replies go out after the response, private
// ones first, and anything this request cannot send waits for the next dispatch
export const receiveInstagramWebhook = controller.createHandlers(jsonBody(body => parseInstagramWebhook(body)), async c => {
    const { queuedIds, publicReplyIds, followupIds, subrequests } = await servicesFor(c).automationWebhook.ingest(c.req.valid('json'));
    // the sends share this invocation's subrequests with the intake and the middleware before it
    const left = FREE_PLAN_SUBREQUESTS - REQUEST_SUBREQUESTS - subrequests;
    if (queuedIds.length > 0 || followupIds.length > 0 || publicReplyIds.length > 0) {
        inBackground(c, 'automation replies', async services => {
            // the three kinds share the background work's time as well as its subrequests
            const started = Date.now();
            const timeBudgetMs = () => BACKGROUND_RUN_MS - (Date.now() - started);
            let spent = 0;
            if (queuedIds.length > 0) spent += (await services.automationProcessor.run({ ids: queuedIds, subrequests: left, timeBudgetMs: timeBudgetMs() })).subrequests;
            if (followupIds.length > 0) spent += (await services.automationFollowups.run({ ids: followupIds, subrequests: left - spent, timeBudgetMs: timeBudgetMs() })).subrequests;
            if (publicReplyIds.length > 0) await services.automationPublicReplies.run({ ids: publicReplyIds, subrequests: left - spent, timeBudgetMs: timeBudgetMs() });
        });
    }
    return c.json({ success: true });
});
