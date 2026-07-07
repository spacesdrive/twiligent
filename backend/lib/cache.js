// All functions accept `redis` as first argument — same pattern as db.js.

export async function getVideosCache(redis, userId, accountId) {
    return (await redis.get(`videos:${userId}:${accountId}`)) || null;
}

export async function setVideosCache(redis, userId, accountId, data) {
    await redis.set(`videos:${userId}:${accountId}`, data);
}

export async function deleteVideosCache(redis, userId, accountId) {
    await redis.del(`videos:${userId}:${accountId}`);
}

export async function getIGCache(redis, userId, accountId) {
    return (await redis.get(`ig:${userId}:${accountId}`)) || null;
}

export async function setIGCache(redis, userId, accountId, data) {
    await redis.set(`ig:${userId}:${accountId}`, data);
}

export async function deleteIGCache(redis, userId, accountId) {
    await redis.del(`ig:${userId}:${accountId}`);
}

export async function setOAuthState(redis, state, userId) {
    await redis.set(`oauth_ig:${state}`, userId, { ex: 600 });
}

export async function getAndDeleteOAuthState(redis, state) {
    const userId = await redis.get(`oauth_ig:${state}`);
    if (userId) await redis.del(`oauth_ig:${state}`);
    return userId || null;
}
