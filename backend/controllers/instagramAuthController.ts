import { controller, servicesFor } from './http.ts';
import { jsonBody, queryParams } from '../middleware/validate.ts';
import { requestLogger } from '../middleware/requestContext.ts';
import { parseInstagramCallback, parseInstagramComplete } from '../validators/instagramAuthValidators.ts';
import { errorFields } from '../lib/logger.ts';
import type { InstagramAuthUrlResponse, InstagramConnectCompleteResponse } from '../../shared/types/instagram.ts';

// protected: the signed state carries the user id to the public callback
export const getInstagramAuthUrl = controller.createHandlers(async c => {
    const url = await servicesFor(c).instagramConnect.authorizationUrl(c.get('userId'));
    return c.json({ url } satisfies InstagramAuthUrlResponse);
});

// public: Instagram sends the browser here. The state proves the sign-in came from this app, but not who opened the
// link, so the code goes back to the app in the fragment, which never reaches a server or a referrer, and the
// signed-in person finishes the connection through the complete route
export const handleInstagramCallback = controller.createHandlers(queryParams(parseInstagramCallback), async c => {
    const { code, state, error, errorReason } = c.req.valid('query');
    const connect = servicesFor(c).instagramConnect;
    const backToAccounts = (query: string) => c.redirect(`${connect.accountsPageUrl}?${query}`);

    if (error || !code || !state) return backToAccounts(`ig_error=${encodeURIComponent(errorReason || error || 'cancelled')}`);
    if (!connect.configured) return backToAccounts('ig_error=not_configured');

    try {
        if (!await connect.userIdFromState(state)) return backToAccounts('ig_error=invalid_state');
    } catch (err) {
        requestLogger(c).error('instagram callback failed', errorFields(err));
        return backToAccounts('ig_error=invalid_state');
    }
    return c.redirect(`${connect.accountsPageUrl}#ig_code=${encodeURIComponent(code)}&ig_state=${encodeURIComponent(state)}`);
});

// protected: connects the account only when the sign-in was started by the person now signed in
export const completeInstagramConnection = controller.createHandlers(jsonBody(parseInstagramComplete), async c => {
    const { code, state } = c.req.valid('json');
    const outcome = await servicesFor(c).instagramConnect.completeForUser(c.get('userId'), code, state);
    return c.json({ success: true, outcome } satisfies InstagramConnectCompleteResponse);
});
