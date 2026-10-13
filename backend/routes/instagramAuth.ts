import { verifyOAuthState } from '../lib/oauthState.ts';
import {
    readInstagramOAuthConfig, buildAuthorizationUrl, connectInstagramFromOAuth, isOAuthConfigured,
} from '../services/instagramOAuth.ts';
import type { AppContext } from '../types/app.ts';
import type { InstagramAuthUrlResponse } from '../../shared/types/instagram.ts';

// GET /api/auth/instagram/url - protected; returns the frontend redirect url
export async function urlHandler(c: AppContext) {
    try {
        const config = readInstagramOAuthConfig(c.env);
        if (!isOAuthConfigured(config)) {
            return c.json({ success: false, message: 'Instagram App credentials not configured on server' }, 500);
        }
        return c.json({ url: await buildAuthorizationUrl(config, c.get('userId')) } satisfies InstagramAuthUrlResponse);
    } catch (err) {
        console.error('Instagram URL handler error:', (err as Error).message);
        return c.json({ success: false, message: 'Failed to generate auth URL: ' + (err as Error).message }, 500);
    }
}

// GET /api/auth/instagram/callback - public; the signed state gives the userId
export async function callbackHandler(c: AppContext) {
    const { code, state, error, error_reason: errorReason } = c.req.query();
    const config = readInstagramOAuthConfig(c.env);
    const accountsUrl = `${config.frontendUrl}/accounts`;

    if (error || !code || !state) {
        const reason = errorReason || error || 'cancelled';
        return c.redirect(`${accountsUrl}?ig_error=${encodeURIComponent(reason)}`);
    }

    if (!isOAuthConfigured(config)) {
        return c.redirect(`${accountsUrl}?ig_error=not_configured`);
    }

    try {
        const userId = await verifyOAuthState(state, config.appSecret);
        if (!userId) return c.redirect(`${accountsUrl}?ig_error=invalid_state`);

        const outcome = await connectInstagramFromOAuth(c.get('supabase'), userId, config, code);
        if (outcome === 'already_added') return c.redirect(`${accountsUrl}?ig_error=already_added`);
        return c.redirect(`${accountsUrl}?ig_connected=true`);
    } catch (err) {
        console.error('Instagram OAuth callback error:', (err as Error).message);
        return c.redirect(`${accountsUrl}?ig_error=${encodeURIComponent((err as Error).message.substring(0, 100))}`);
    }
}
