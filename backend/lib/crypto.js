// AES-256-GCM encryption and TOTP generation using the Web Crypto API (built into Cloudflare Workers).
// AES key is a 64-char hex string (32 bytes). Ciphertext format: "<iv_hex>:<ciphertext_hex>"

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

// TOTP (RFC 6238) using HMAC-SHA1 via crypto.subtle. No npm dependency.
// base32Secret is the raw Base32 string from the authenticator app QR code.
function base32Decode(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0, value = 0;
    const output = [];
    for (const char of cleaned) {
        const idx = alphabet.indexOf(char);
        if (idx === -1) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return new Uint8Array(output);
}

export async function generateTOTP(base32Secret) {
    const secret = base32Decode(base32Secret);
    const counter = Math.floor(Date.now() / 30000);
    const counterBuf = new ArrayBuffer(8);
    const view = new DataView(counterBuf);
    view.setUint32(0, Math.floor(counter / 0x100000000) >>> 0, false);
    view.setUint32(4, counter >>> 0, false);

    const key = await crypto.subtle.importKey(
        'raw', secret.buffer, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
    );
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBuf));
    const offset = sig[19] & 0xf;
    const code = (
        ((sig[offset]     & 0x7f) << 24) |
        ((sig[offset + 1] & 0xff) << 16) |
        ((sig[offset + 2] & 0xff) << 8)  |
         (sig[offset + 3] & 0xff)
    ) % 1_000_000;
    return String(code).padStart(6, '0');
}
