// All functions accept `redis` as first argument.
// If redis is null (Upstash not configured) all operations are silent no-ops.

export async function getVideosCache(redis, userId, accountId) {
    if (!redis) return null;
    return (await redis.get(`videos:${userId}:${accountId}`)) || null;
}

export async function setVideosCache(redis, userId, accountId, data) {
    if (!redis) return;
    await redis.set(`videos:${userId}:${accountId}`, data);
}

export async function deleteVideosCache(redis, userId, accountId) {
    if (!redis) return;
    await redis.del(`videos:${userId}:${accountId}`);
}

export async function getIGCache(redis, userId, accountId) {
    if (!redis) return null;
    return (await redis.get(`ig:${userId}:${accountId}`)) || null;
}

export async function setIGCache(redis, userId, accountId, data) {
    if (!redis) return;
    await redis.set(`ig:${userId}:${accountId}`, data);
}

export async function deleteIGCache(redis, userId, accountId) {
    if (!redis) return;
    await redis.del(`ig:${userId}:${accountId}`);
}

// ---- OAuth state via HMAC (no Redis required) --------------------------------
// State format: base64url(userId:timestamp) . base64url(HMAC-SHA256 signature)
// Expires after 10 minutes. Secret is INSTAGRAM_APP_SECRET.

async function hmacSign(secret, message) {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    return btoa(String.fromCharCode(...new Uint8Array(sig)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacVerify(secret, message, signature) {
    const expected = await hmacSign(secret, message);
    return expected === signature;
}

export async function createOAuthState(userId, secret) {
    const payload = btoa(`${userId}:${Date.now()}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const sig = await hmacSign(secret, payload);
    return `${payload}.${sig}`;
}

export async function verifyOAuthState(state, secret) {
    const dot = state.lastIndexOf('.');
    if (dot === -1) return null;
    const payload = state.slice(0, dot);
    const sig = state.slice(dot + 1);
    const valid = await hmacVerify(secret, payload, sig);
    if (!valid) return null;
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const [userId, ts] = decoded.split(':');
    if (Date.now() - Number(ts) > 10 * 60 * 1000) return null;
    return userId;
}

// Legacy Redis-backed OAuth state (used only when Redis is available)
export async function setOAuthState(redis, state, userId) {
    if (!redis) return;
    await redis.set(`oauth_ig:${state}`, userId, { ex: 600 });
}

export async function getAndDeleteOAuthState(redis, state) {
    if (!redis) return null;
    const userId = await redis.get(`oauth_ig:${state}`);
    if (userId) await redis.del(`oauth_ig:${state}`);
    return userId || null;
}
