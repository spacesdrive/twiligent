import { controller, servicesFor } from './http.ts';
import { jsonBody } from '../middleware/validate.ts';
import { parseAuthEmailHook } from '../validators/authHookValidators.ts';

// called by Supabase Auth, not a browser: verifyAuthHook has already checked the signature and the webhook-id
export const sendAuthEmail = controller.createHandlers(jsonBody(parseAuthEmailHook), async c => {
    await servicesFor(c).authEmail.send(c.req.valid('json'), c.req.header('webhook-id') ?? '');
    return c.json({});
});
