// Meta signs each webhook with HMAC-SHA256 over the raw body and the app secret, sent as "sha256=<hex>" in X-Hub-Signature-256
const SIGNATURE_PREFIX = 'sha256=';

function fromHex(text: string): Uint8Array<ArrayBuffer> | null {
    if (!/^[0-9a-f]+$/i.test(text) || text.length % 2 !== 0) return null;
    const bytes = new Uint8Array(text.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
    return bytes;
}

// true when any of the secrets made the signature; Instagram Login apps sign with the Instagram app secret,
// and the Meta app secret is accepted too because the dashboard shows both
export async function verifyMetaSignature(secrets: string[], header: string | undefined, body: ArrayBuffer): Promise<boolean> {
    if (!header?.startsWith(SIGNATURE_PREFIX)) return false;
    const signature = fromHex(header.slice(SIGNATURE_PREFIX.length));
    if (!signature) return false;
    for (const secret of secrets) {
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
        // subtle.verify compares in constant time
        if (await crypto.subtle.verify('HMAC', key, signature, body)) return true;
    }
    return false;
}

// compares digests, so the time taken does not reveal how much of the token was right
export async function verifyTokenMatches(expected: string, given: string): Promise<boolean> {
    const digest = async (text: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
    const [a, b] = await Promise.all([digest(expected), digest(given)]);
    let difference = 0;
    for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
    return difference === 0;
}
