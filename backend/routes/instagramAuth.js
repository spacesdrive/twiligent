import { createOAuthState, verifyOAuthState } from '../lib/cache.js';
import { createAccount, getAccounts } from '../lib/db.js';
import { fetchInstagramProfile } from '../services/instagram.js';

// GET /api/auth/instagram/url - protected (requireAuth applied by the sub-app in server.js)
// Returns the Instagram OAuth authorization URL for the frontend to redirect to.
export async function urlHandler(c) {
    try {
        const APP_ID = c.env.INSTAGRAM_APP_ID?.replace(/^﻿/, '').trim();
        const APP_SECRET = c.env.INSTAGRAM_APP_SECRET?.replace(/^﻿/, '').trim();
        if (!APP_ID || !APP_SECRET) {
            return c.json({ success: false, message: 'Instagram App credentials not configured on server' }, 500);
        }

        const REDIRECT_URI = `${c.env.BACKEND_URL || 'http://localhost:8787'}/api/auth/instagram/callback`;

        // HMAC-signed state - no Redis needed, userId + timestamp embedded
        const state = await createOAuthState(c.get('userId'), APP_SECRET);

        const params = new URLSearchParams({
            force_reauth: 'true',
            client_id: APP_ID,
            redirect_uri: REDIRECT_URI,
            response_type: 'code',
            scope: 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights',
            state,
        });

        return c.json({ url: `https://www.instagram.com/oauth/authorize?${params}` });
    } catch (err) {
        console.error('Instagram URL handler error:', err.message);
        return c.json({ success: false, message: 'Failed to generate auth URL: ' + err.message }, 500);
    }
}

// GET /api/auth/instagram/callback - public (browser redirect from Instagram)
// No auth header here - userId is recovered from the HMAC state token.
export async function callbackHandler(c) {
    const { code, state, error, error_reason } = c.req.query();
    const FRONTEND_URL = (c.env.FRONTEND_URL || 'http://localhost:5173').replace(/^﻿/, '').trim();
    const BACKEND_URL = (c.env.BACKEND_URL || 'http://localhost:8787').replace(/^﻿/, '').trim();
    const REDIRECT_URI = `${BACKEND_URL}/api/auth/instagram/callback`;
    const APP_ID = c.env.INSTAGRAM_APP_ID?.replace(/^﻿/, '').trim();
    const APP_SECRET = c.env.INSTAGRAM_APP_SECRET?.replace(/^﻿/, '').trim();

    if (error || !code || !state) {
        const reason = error_reason || error || 'cancelled';
        return c.redirect(`${FRONTEND_URL}/accounts?ig_error=${encodeURIComponent(reason)}`);
    }

    // Verify HMAC state - recovers userId without Redis
    const userId = await verifyOAuthState(state, APP_SECRET);
    if (!userId) {
        return c.redirect(`${FRONTEND_URL}/accounts?ig_error=invalid_state`);
    }

    try {
        // Exchange code for short-lived access token
        const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: APP_ID,
                client_secret: APP_SECRET,
                grant_type: 'authorization_code',
                redirect_uri: REDIRECT_URI,
                code: code.replace(/#.*$/, ''), // strip trailing #_ Instagram sometimes appends
            }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            throw new Error(tokenData.error_message || JSON.stringify(tokenData));
        }

        // Exchange short-lived for long-lived token (60 days)
        const longParams = new URLSearchParams({
            grant_type: 'ig_exchange_token',
            client_id: APP_ID,
            client_secret: APP_SECRET,
            access_token: tokenData.access_token,
        });
        const longRes = await fetch(`https://graph.instagram.com/access_token?${longParams}`);
        const longData = await longRes.json();
        const finalToken = longData.access_token || tokenData.access_token;
        const expiresIn = longData.expires_in || 0;

        const supabase = c.get('supabase');

        const profile = await fetchInstagramProfile(null, finalToken);
        if (!profile.igUserId) {
            throw new Error('Could not get Instagram User ID. Account must be a Business or Creator account.');
        }

        const existing = await getAccounts(supabase, userId);
        if (existing.find(a => a.platform === 'instagram' && a.igUserId === profile.igUserId)) {
            return c.redirect(`${FRONTEND_URL}/accounts?ig_error=already_added`);
        }

        const newAccount = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            platform: 'instagram',
            igUserId: profile.igUserId,
            username: profile.username,
            title: profile.name || profile.username,
            biography: profile.biography,
            website: profile.website,
            profilePictureUrl: profile.profilePictureUrl,
            followersCount: profile.followersCount,
            followsCount: profile.followsCount,
            mediaCount: profile.mediaCount,
            accessToken: finalToken,
            tokenExpiresAt: expiresIn > 0
                ? new Date(Date.now() + expiresIn * 1000).toISOString()
                : null,
            addedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
        };

        await createAccount(supabase, newAccount, userId);
        return c.redirect(`${FRONTEND_URL}/accounts?ig_connected=true`);
    } catch (err) {
        console.error('Instagram OAuth callback error:', err.message);
        return c.redirect(`${FRONTEND_URL}/accounts?ig_error=${encodeURIComponent(err.message.substring(0, 100))}`);
    }
}
