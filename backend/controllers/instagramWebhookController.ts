import { controller, inBackground, servicesFor } from './http.ts';
import { jsonBody, queryParams } from '../middleware/validate.ts';
import { parseWebhookVerification } from '../validators/automationValidators.ts';
import { parseInstagramWebhook } from '../validators/instagramWebhookValidators.ts';

// called by Meta when the webhook is saved in its dashboard; the answer is the bare challenge, not JSON
export const verifyInstagramWebhook = controller.createHandlers(queryParams(parseWebhookVerification), async c => {
    const challenge = await servicesFor(c).automationWebhook.challengeAnswer(c.req.valid('query'));
    return c.text(challenge);
});

// called by Meta, not a browser: verifyMetaWebhook has already checked the signature. The comments are stored before
// the 200, so Meta keeps retrying for 36 hours if storing fails; the replies go out after the response
export const receiveInstagramWebhook = controller.createHandlers(jsonBody(body => parseInstagramWebhook(body)), async c => {
    const { queuedIds } = await servicesFor(c).automationWebhook.ingest(c.req.valid('json'));
    if (queuedIds.length > 0) inBackground(c, 'automation replies', services => services.automationProcessor.run({ ids: queuedIds }));
    return c.json({ success: true });
});
