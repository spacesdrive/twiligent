import type { Next } from 'hono';
import { readAuthEmailConfig } from '../lib/config.ts';
import { NotConfiguredError, UnauthorizedError } from '../lib/errors.ts';
import { verifyWebhookSignature } from '../lib/webhookSignature.ts';
import type { AppContext } from '../types/app.ts';

// the hook route is public, so the signature is what proves the request came from this project's Supabase Auth
export async function verifyAuthHook(c: AppContext, next: Next): Promise<void> {
    const { hookSecret } = readAuthEmailConfig(c.env);
    if (!hookSecret) throw new NotConfiguredError('Email sending is not set up: the SEND_EMAIL_HOOK_SECRET Worker secret is missing');

    // hono caches the body, so the validator after this reads the same text
    const body = await c.req.text();
    const headers = {
        id: c.req.header('webhook-id'),
        timestamp: c.req.header('webhook-timestamp'),
        signature: c.req.header('webhook-signature'),
    };
    if (!await verifyWebhookSignature(hookSecret, headers, body)) {
        throw new UnauthorizedError('The hook signature is missing, invalid or expired');
    }
    await next();
}
