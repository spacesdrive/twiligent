export interface RecordedRequest {
    url: string;
    method: string;
    headers?: RequestInit['headers'];
    body?: string;
}

export interface FakeReply {
    body: unknown;
    status: number;
    statusText: string;
    headers?: Record<string, string>;
}

export type Responder = (request: RecordedRequest, count: number) => FakeReply | Error | Promise<FakeReply | Error>;

export interface FetchMock {
    requests: RecordedRequest[];
    restore(): void;
}

// replaces global fetch with a scripted responder and records each request
export function reply(body: unknown, status = 200, statusText = 'OK', headers?: Record<string, string>): FakeReply {
    return headers ? { body, status, statusText, headers } : { body, status, statusText };
}

export function installFetch(respond: Responder): FetchMock {
    const requests: RecordedRequest[] = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url: unknown, options: RequestInit = {}): Promise<Response> => {
        const request: RecordedRequest = { url: String(url), method: options.method ?? 'GET' };
        if (options.headers) request.headers = options.headers;
        if (options.body !== undefined) request.body = String(options.body);
        requests.push(request);

        const outcome = await respond(request, requests.length);
        if (outcome instanceof Error) throw outcome;
        return {
            status: outcome.status,
            statusText: outcome.statusText,
            ok: outcome.status >= 200 && outcome.status < 300,
            headers: new Headers(outcome.headers ?? {}),
            json: async () => outcome.body,
        } as unknown as Response;
    };

    return {
        requests,
        restore() { globalThis.fetch = originalFetch; },
    };
}
