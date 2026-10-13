import { Hono } from 'hono';

// mounts a router behind a middleware that fills the context the way server.js does
export function mountWithContext(register, context) {
    const app = new Hono();
    app.use('*', async (c, next) => {
        Object.entries(context).forEach(([key, value]) => c.set(key, value));
        await next();
    });
    register(app);
    return app;
}

export async function callRoute(app, method, path, options = {}) {
    const init = { method };
    if (options.json !== undefined) {
        init.body = typeof options.json === 'string' ? options.json : JSON.stringify(options.json);
        init.headers = { 'Content-Type': 'application/json' };
    }
    const response = await app.request(path, init, options.env ?? {});
    const result = { status: response.status, body: await response.text() };
    const location = response.headers.get('location');
    if (location !== null) result.location = location;
    return result;
}

export function fakeRedis() {
    const deleted = [];
    return {
        deleted,
        async del(key) { deleted.push(key); },
    };
}
