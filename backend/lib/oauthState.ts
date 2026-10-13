// state format: base64url(userId:timestamp).base64url(hmac-sha256 signature)
const STATE_TTL_MS = 10 * 60 * 1000;

function toBase64Url(text: string): string {
    return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

async function hmacSign(secret: string, message: string): Promise<string> {
    const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), new TextEncoder().encode(message));
    return toBase64Url(String.fromCharCode(...new Uint8Array(signature)));
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
    try {
        return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
    } catch {
        // a tampered state is not valid base64
        return null;
    }
}

// subtle.verify compares in constant time, unlike comparing the two signatures as strings
async function hmacVerify(secret: string, message: string, signature: string): Promise<boolean> {
    const signatureBytes = fromBase64Url(signature);
    if (!signatureBytes) return false;
    return crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), signatureBytes, new TextEncoder().encode(message));
}

export async function createOAuthState(userId: string, secret: string): Promise<string> {
    const payload = toBase64Url(`${userId}:${Date.now()}`);
    const signature = await hmacSign(secret, payload);
    return `${payload}.${signature}`;
}

export async function verifyOAuthState(state: string, secret: string): Promise<string | null> {
    const separatorIndex = state.lastIndexOf('.');
    if (separatorIndex === -1) return null;

    const payload = state.slice(0, separatorIndex);
    const signature = state.slice(separatorIndex + 1);
    const isValid = await hmacVerify(secret, payload, signature);
    if (!isValid) return null;

    const decoded = fromBase64Url(payload);
    if (!decoded) return null;
    const [userId, createdAt] = new TextDecoder().decode(decoded).split(':');
    if (Date.now() - Number(createdAt) > STATE_TTL_MS) return null;

    return userId;
}
