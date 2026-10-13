// Standard Webhooks (https://www.standardwebhooks.com), as Supabase Auth hooks sign them:
// HMAC-SHA256 over "id.timestamp.body" with the base64 key from a "v1,whsec_<base64>" secret.
const TOLERANCE_SECONDS = 5 * 60;
const SECRET_PREFIX = /^(v1,)?whsec_/;

export interface WebhookHeaders {
    id: string | undefined;
    timestamp: string | undefined;
    signature: string | undefined;
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> | null {
    try {
        return Uint8Array.from(atob(text), char => char.charCodeAt(0));
    } catch {
        return null;
    }
}

// true only for a signature made with the secret within five minutes of now, which stops replays of old requests
export async function verifyWebhookSignature(secret: string, headers: WebhookHeaders, body: string, nowMs = Date.now()): Promise<boolean> {
    const { id, timestamp, signature } = headers;
    if (!id || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
    if (Math.abs(nowMs / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false;

    const keyBytes = fromBase64(secret.replace(SECRET_PREFIX, ''));
    if (!keyBytes) return false;
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const signed = new TextEncoder().encode(`${id}.${timestamp}.${body}`);

    // the header lists "v1,<base64>" entries separated by spaces, one per active key
    for (const entry of signature.split(' ')) {
        const [version, value] = entry.split(',');
        if (version !== 'v1' || !value) continue;
        const candidate = fromBase64(value);
        // subtle.verify compares in constant time
        if (candidate && await crypto.subtle.verify('HMAC', key, candidate, signed)) return true;
    }
    return false;
}
