// encrypts platform tokens at rest with AES-GCM under a key derived from TOKEN_ENCRYPTION_KEY, so a database leak alone
// does not hand out Google access; format: v1.<base64url iv>.<base64url ciphertext and tag>
const VERSION = 'v1';
// AES-GCM's standard nonce length; a fresh random one for every value
const IV_BYTES = 12;

function toBase64Url(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
}

// a separate info string keeps this key apart from the MCP confirmation key derived from the same secret
async function tokenKey(secret: string): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode('twiligent stored tokens') },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
}

export async function encryptToken(plain: string, secret: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await tokenKey(secret), new TextEncoder().encode(plain));
    return `${VERSION}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(sealed))}`;
}

// null when the value was changed, sealed under another key, or is not one of ours; the caller asks for a reconnect
export async function decryptToken(sealed: string, secret: string): Promise<string | null> {
    const [version, iv, data] = sealed.split('.');
    if (version !== VERSION || !iv || !data) return null;
    try {
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64Url(iv) }, await tokenKey(secret), fromBase64Url(data));
        return new TextDecoder().decode(plain);
    } catch {
        return null;
    }
}
