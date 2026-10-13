// replaces global fetch with a scripted responder and records each request
export function reply(body, status = 200, statusText = 'OK') {
    return { body, status, statusText };
}

export function installFetch(respond) {
    const requests = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url, options = {}) => {
        const request = { url: String(url), method: options.method ?? 'GET' };
        if (options.headers) request.headers = options.headers;
        if (options.body !== undefined) request.body = String(options.body);
        requests.push(request);

        const outcome = await respond(request, requests.length);
        if (outcome instanceof Error) throw outcome;
        return {
            status: outcome.status,
            statusText: outcome.statusText,
            ok: outcome.status >= 200 && outcome.status < 300,
            json: async () => outcome.body,
        };
    };

    return {
        requests,
        restore() { globalThis.fetch = originalFetch; },
    };
}
