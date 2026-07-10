// AES-256-GCM encryption using the Web Crypto API (built into Cloudflare Workers).
// Key is a 64-char hex string (32 bytes). Ciphertext format: "<iv_hex>:<ciphertext_hex>"

function hexToBuffer(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    return bytes.buffer;
}

function bufferToHex(buf) {
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function importKey(keyHex) {
    return crypto.subtle.importKey('raw', hexToBuffer(keyHex), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptPassword(plaintext, keyHex) {
    const key = await importKey(keyHex);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plaintext)
    );
    return `${bufferToHex(iv.buffer)}:${bufferToHex(ciphertext)}`;
}

export async function decryptPassword(encrypted, keyHex) {
    const [ivHex, cipherHex] = encrypted.split(':');
    const key = await importKey(keyHex);
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: hexToBuffer(ivHex) },
        key,
        hexToBuffer(cipherHex)
    );
    return new TextDecoder().decode(plaintext);
}
