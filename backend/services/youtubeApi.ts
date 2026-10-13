// adds the key to the caller's params object, as callers always pass a fresh one
export async function ytFetch(endpoint, params, apiKey) {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    params.key = apiKey;
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url.toString());
    const data = await response.json();
    if (data.error) {
        const err = new Error(data.error.message);
        err.reason = data.error.errors?.[0]?.reason || '';
        err.status = data.error.code;
        throw err;
    }
    return data;
}

export function optionalCount(value) {
    if (value == null) return null;
    const count = parseInt(value, 10);
    return Number.isFinite(count) ? count : null;
}
