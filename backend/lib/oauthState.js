// state format: base64url(userId:timestamp).base64url(hmac-sha256 signature)
const STATE_TTL_MS = 10 * 60 * 1000;

function toBase64Url(text) {
    return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacSign(secret, message) {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    return toBase64Url(String.fromCharCode(...new Uint8Array(signature)));
}

async function hmacVerify(secret, message, signature) {
    const expected = await hmacSign(secret, message);
    return expected === signature;
}

export async function createOAuthState(userId, secret) {
    const payload = toBase64Url(`${userId}:${Date.now()}`);
    const signature = await hmacSign(secret, payload);
    return `${payload}.${signature}`;
}

export async function verifyOAuthState(state, secret) {
    const separatorIndex = state.lastIndexOf('.');
    if (separatorIndex === -1) return null;

    const payload = state.slice(0, separatorIndex);
    const signature = state.slice(separatorIndex + 1);
    const isValid = await hmacVerify(secret, payload, signature);
    if (!isValid) return null;

    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const [userId, createdAt] = decoded.split(':');
    if (Date.now() - Number(createdAt) > STATE_TTL_MS) return null;

    return userId;
}
