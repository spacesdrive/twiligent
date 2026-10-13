import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { requestId } from 'hono/request-id';
import { errorHandler, notFoundHandler } from '../../middleware/errorHandler.ts';
import { jsonBody } from '../../middleware/validate.ts';
import { requiredString } from '../../validators/fields.ts';
import { ConflictError, DatabaseError, NotFoundError, UpstreamError, ValidationError } from '../../lib/errors.ts';
import type { AppEnv } from '../../types/app.ts';

let logLines: string[] = [];

beforeEach(() => {
    logLines = [];
    for (const method of ['log', 'warn', 'error'] as const) {
        mock.method(console, method, (line: string) => logLines.push(line));
    }
});
afterEach(() => mock.restoreAll());

function buildApp() {
    const app = new Hono<AppEnv>();
    app.use(requestId({ generator: () => 'req-1' }));
    app.onError(errorHandler);
    app.notFound(notFoundHandler);
    app.get('/not-found', () => { throw new NotFoundError('Account not found'); });
    app.get('/conflict', () => { throw new ConflictError('This channel is already added'); });
    app.get('/upstream', () => { throw new UpstreamError('Quota exceeded for https://www.googleapis.com/youtube/v3/videos?key=SECRET'); });
    app.get('/database', () => { throw new DatabaseError('accounts.list', new Error('duplicate key value violates constraint')); });
    app.get('/crash', () => { throw new TypeError('Cannot read properties of undefined'); });
    app.post('/body', jsonBody(body => ({ name: requiredString(body, 'name', 'Name is required') })), c => c.json(c.req.valid('json')));
    app.get('/validation', () => { throw new ValidationError('Pick a date in the future'); });
    return app;
}

async function call(path: string, init?: RequestInit) {
    const response = await buildApp().request(path, init);
    return { status: response.status, body: await response.json() as Record<string, unknown> };
}

describe('error handler', () => {
    test('each application error gets its status and the one error body', async () => {
        assert.deepEqual(await call('/not-found'), { status: 404, body: { success: false, code: 'NOT_FOUND', message: 'Account not found', requestId: 'req-1' } });
        assert.deepEqual(await call('/conflict'), { status: 409, body: { success: false, code: 'CONFLICT', message: 'This channel is already added', requestId: 'req-1' } });
        assert.deepEqual(await call('/validation'), { status: 400, body: { success: false, code: 'VALIDATION_ERROR', message: 'Pick a date in the future', requestId: 'req-1' } });
    });

    test('platform errors keep their wording without the url', async () => {
        assert.deepEqual(await call('/upstream'), { status: 502, body: { success: false, code: 'UPSTREAM_ERROR', message: 'Quota exceeded for [url]', requestId: 'req-1' } });
    });

    test('database and unexpected errors hide their details from the client but log them with the request id', async () => {
        const database = await call('/database');
        assert.deepEqual(database, { status: 500, body: { success: false, code: 'DATABASE_ERROR', message: 'The database request failed. Try again in a moment.', requestId: 'req-1' } });
        const crash = await call('/crash');
        assert.equal(crash.status, 500);
        assert.equal(crash.body.code, 'INTERNAL_ERROR');
        assert.equal(JSON.stringify(crash.body).includes('Cannot read'), false);

        const logged = logLines.map(line => JSON.parse(line) as Record<string, unknown>);
        assert.deepEqual(logged.map(line => [line.level, line.requestId, line.cause ?? line.error]), [
            ['error', 'req-1', 'duplicate key value violates constraint'],
            ['error', 'req-1', 'Cannot read properties of undefined'],
        ]);
    });

    test('validation runs before the handler: missing fields and malformed JSON are 400s', async () => {
        const json = (body: string) => ({ method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
        assert.deepEqual(await call('/body', json('{"name":"  Ribbon "}')), { status: 200, body: { name: 'Ribbon' } });
        assert.deepEqual(await call('/body', json('{}')), { status: 400, body: { success: false, code: 'VALIDATION_ERROR', message: 'Name is required', requestId: 'req-1' } });
        assert.deepEqual(await call('/body', json('[1]')), { status: 400, body: { success: false, code: 'VALIDATION_ERROR', message: 'The request body must be a JSON object', requestId: 'req-1' } });
        const malformed = await call('/body', json('{not json'));
        assert.equal(malformed.status, 400);
        assert.equal(malformed.body.code, 'VALIDATION_ERROR');
    });

    test('an unknown route is a 404 in the same shape', async () => {
        assert.deepEqual(await call('/nope'), { status: 404, body: { success: false, code: 'NOT_FOUND', message: 'No API route matches GET /nope', requestId: 'req-1' } });
    });
});
