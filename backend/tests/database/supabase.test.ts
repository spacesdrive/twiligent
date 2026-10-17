import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DB_TIMEOUT_MS, getSupabase } from '../../database/supabase.ts';
import type { Env } from '../../types/env.ts';

const ENV = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_KEY: 'service', SUPABASE_ANON_KEY: 'anon' } as Env;

test('a database call that never answers is cut off at the timeout and comes back as an error', async t => {
    mock.timers.enable({ apis: ['setTimeout'] });
    t.after(() => mock.timers.reset());
    // a database that accepts the request and never answers, until the request is aborted
    const hanging = mock.method(globalThis, 'fetch', (_url: unknown, init: RequestInit = {}) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
    }));
    t.after(() => hanging.mock.restore());

    let settled = false;
    const query = Promise.resolve(getSupabase(ENV).from('accounts').select('id').limit(1)).finally(() => { settled = true; });
    // the client reads its auth header first, and the timeout starts when the request goes out
    while (hanging.mock.callCount() === 0) await new Promise(resolve => setImmediate(resolve));
    mock.timers.tick(DB_TIMEOUT_MS - 1);
    await Promise.resolve();
    assert.equal(settled, false);

    mock.timers.tick(1);
    const result = await query;
    assert.ok(result.error, 'the query reports an error instead of hanging');
    assert.equal(hanging.mock.callCount(), 1);
});
