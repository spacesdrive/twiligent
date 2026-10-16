import { controller, servicesFor } from './http.ts';
import { queryParams } from '../middleware/validate.ts';
import { requestLogger } from '../middleware/requestContext.ts';
import { parseInstagramCallback } from '../validators/instagramAuthValidators.ts';
import { errorFields } from '../lib/logger.ts';
import type { InstagramAuthUrlResponse } from '../../shared/types/instagram.ts';

// protected: the signed state carries the user id to the public callback
export const getInstagramAuthUrl = controller.createHandlers(async c => {
    const url = await servicesFor(c).instagramConnect.authorizationUrl(c.get('userId'));
    return c.json({ url } satisfies InstagramAuthUrlResponse);
});

// public: Instagram sends the browser here, so every outcome is a redirect back to the accounts page
export const handleInstagramCallback = controller.createHandlers(queryParams(parseInstagramCallback), async c => {
    const { code, state, error, errorReason } = c.req.valid('query');
    const connect = servicesFor(c).instagramConnect;
    const backToAccounts = (query: string) => c.redirect(`${connect.accountsPageUrl}?${query}`);

    if (error || !code || !state) return backToAccounts(`ig_error=${encodeURIComponent(errorReason || error || 'cancelled')}`);
    if (!connect.configured) return backToAccounts('ig_error=not_configured');

    try {
        const userId = await connect.userIdFromState(state);
        if (!userId) return backToAccounts('ig_error=invalid_state');
        const outcome = await connect.connect(userId, code);
        return backToAccounts(outcome === 'reconnected' ? 'ig_connected=reconnected' : 'ig_connected=true');
    } catch (err) {
        requestLogger(c).error('instagram connection failed', errorFields(err));
        return backToAccounts(`ig_error=${encodeURIComponent((err as Error).message.substring(0, 100))}`);
    }
});
