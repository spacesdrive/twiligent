import type { AuthEmailHook } from '../../types/authHook.ts';

// a Supabase-style hook secret: "v1,whsec_" and a base64 key
export const HOOK_KEY = 'c2VjcmV0LWtleS1mb3ItdGVzdHM=';
export const HOOK_SECRET = `v1,whsec_${HOOK_KEY}`;

// signs the way Supabase Auth does: HMAC-SHA256 over "id.timestamp.body", base64, prefixed with "v1,"
export async function signWebhook(id: string, timestamp: number, body: string, key = HOOK_KEY): Promise<string> {
    const keyBytes = Uint8Array.from(atob(key), char => char.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
    return `v1,${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

export async function signedHeaders(body: string, id = 'msg_1', timestamp = Math.floor(Date.now() / 1000)): Promise<Record<string, string>> {
    return {
        'Content-Type': 'application/json',
        'webhook-id': id,
        'webhook-timestamp': String(timestamp),
        'webhook-signature': await signWebhook(id, timestamp, body),
    };
}

export function signupPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        user: { id: 'user-1', email: 'new@example.com' },
        email_data: {
            token: '123456',
            token_hash: 'hash-abc',
            redirect_to: 'https://app.example.com/',
            email_action_type: 'signup',
            site_url: 'https://app.example.com',
            token_new: '',
            token_hash_new: '',
            ...overrides,
        },
    };
}

export function hook(overrides: Partial<AuthEmailHook> = {}): AuthEmailHook {
    return {
        email: 'new@example.com',
        newEmail: undefined,
        action: 'signup',
        token: '123456',
        tokenHash: 'hash-abc',
        tokenNew: '',
        tokenHashNew: '',
        redirectTo: 'https://app.example.com/',
        siteUrl: 'https://app.example.com',
        ...overrides,
    };
}
