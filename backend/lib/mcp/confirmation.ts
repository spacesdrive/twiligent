import { toBase64Url } from './accessToken.ts';

// an irreversible tool runs only when the second call carries a token from the first: signed, bound to the person,
// the tool and the exact arguments, and short-lived, so text a model reads in a comment cannot approve an action
export const CONFIRMATION_TTL_MS = 5 * 60 * 1000;

export interface ConfirmationSubject {
    userId: string;
    tool: string;
    args: Record<string, unknown>;
}

// the same arguments in any key order give the same text; the token field itself is left out
export function canonicalArgs(args: Record<string, unknown>): string {
    const sort = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(sort);
        if (typeof value !== 'object' || value === null) return value;
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, sort((value as Record<string, unknown>)[key])]));
    };
    const { confirmationToken: _token, ...rest } = args;
    return JSON.stringify(sort(rest));
}

async function signingKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'HKDF', false, ['deriveKey']);
    // derived for this one purpose, so the same Worker secret can also encrypt stored tokens without the keys overlapping
    return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode('twiligent mcp confirmation') },
        material,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        [usage],
    );
}

function payloadOf(subject: ConfirmationSubject, expiresAt: number): string {
    return `${subject.userId}\n${subject.tool}\n${canonicalArgs(subject.args)}\n${expiresAt}`;
}

export async function createConfirmation(subject: ConfirmationSubject, secret: string, now = Date.now()): Promise<string> {
    const expiresAt = now + CONFIRMATION_TTL_MS;
    const signature = await crypto.subtle.sign('HMAC', await signingKey(secret, 'sign'), new TextEncoder().encode(payloadOf(subject, expiresAt)));
    return `${expiresAt}.${toBase64Url(new Uint8Array(signature))}`;
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
    try {
        return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
    } catch {
        // a tampered token is not valid base64
        return null;
    }
}

// subtle.verify compares in constant time; a token for other arguments, another tool or another person fails here
export async function verifyConfirmation(token: unknown, subject: ConfirmationSubject, secret: string, now = Date.now()): Promise<boolean> {
    if (typeof token !== 'string') return false;
    const [expires, signature, extra] = token.split('.');
    const expiresAt = Number(expires);
    if (extra !== undefined || !signature || !Number.isInteger(expiresAt) || expiresAt < now || expiresAt > now + CONFIRMATION_TTL_MS) return false;
    const bytes = fromBase64Url(signature);
    if (!bytes) return false;
    return crypto.subtle.verify('HMAC', await signingKey(secret, 'verify'), bytes, new TextEncoder().encode(payloadOf(subject, expiresAt)));
}
