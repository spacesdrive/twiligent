import type { Next } from 'hono';
import { readAutomationConfig } from '../lib/config.ts';
import { NotConfiguredError, UnauthorizedError, ValidationError } from '../lib/errors.ts';
import { verifyMetaSignature } from '../lib/metaWebhookSignature.ts';
import type { AppContext } from '../types/app.ts';

// Meta batches at most 1,000 changes into one notification, far below this
const MAX_BODY_BYTES = 1024 * 1024;

// the webhook route is public, so the signature over the raw body is what proves the notification came from Meta
export async function verifyMetaWebhook(c: AppContext, next: Next): Promise<void> {
    const { appSecrets } = readAutomationConfig(c.env);
    if (appSecrets.length === 0) throw new NotConfiguredError('Instagram webhooks are not set up: the INSTAGRAM_APP_SECRET Worker secret is missing');

    const declared = Number(c.req.header('Content-Length') ?? 0);
    if (declared > MAX_BODY_BYTES) throw new ValidationError('The notification is larger than 1 MB');
    // hono caches the body, so the validator after this parses the same bytes
    const body = await c.req.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) throw new ValidationError('The notification is larger than 1 MB');

    if (!await verifyMetaSignature(appSecrets, c.req.header('X-Hub-Signature-256'), body)) {
        throw new UnauthorizedError('The webhook signature is missing or invalid');
    }
    await next();
}
