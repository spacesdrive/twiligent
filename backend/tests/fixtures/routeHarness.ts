import { Hono } from 'hono';
import type { AppEnv, AppVariables, Redis } from '../../types/app.ts';
import type { Env } from '../../types/env.ts';

export interface CallOptions {
    json?: unknown;
    env?: Partial<Env>;
}

export type RouteStep = [method: string, path: string, json?: unknown, env?: Partial<Env>];

export interface RouteResult {
    status: number;
    body: string;
    location?: string;
}

export type FakeRedis = Redis & { deleted: string[] };

// mounts a router behind a middleware that fills the context the way server.js does
export function mountWithContext(register: (app: Hono<AppEnv>) => unknown, context: Record<string, unknown>): Hono<AppEnv> {
    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
        Object.entries(context).forEach(([key, value]) => c.set(key as keyof AppVariables, value as never));
        await next();
    });
    register(app);
    return app;
}

export async function callRoute(app: Hono<AppEnv>, method: string, path: string, options: CallOptions = {}): Promise<RouteResult> {
    const init: RequestInit = { method };
    if (options.json !== undefined) {
        init.body = typeof options.json === 'string' ? options.json : JSON.stringify(options.json);
        init.headers = { 'Content-Type': 'application/json' };
    }
    const response = await app.request(path, init, options.env ?? {});
    const result: RouteResult = { status: response.status, body: await response.text() };
    const location = response.headers.get('location');
    if (location !== null) result.location = location;
    return result;
}

export function fakeRedis(): FakeRedis {
    const deleted: string[] = [];
    return {
        deleted,
        async del(key: string) { deleted.push(key); },
    } as unknown as FakeRedis;
}
