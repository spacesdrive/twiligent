import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Env } from '../../types/env.ts';
import { DAILY_CRON, EVERY_FIVE_MINUTES_CRON, EVERY_MINUTE_CRON, cronPlan, runScheduledJob } from '../../jobs/scheduled.ts';

const at = (time: string) => Date.parse(`2026-10-16T${time}:00Z`);

test('the every minute trigger dispatches due replies and follow-ups at every minute', () => {
    for (const time of ['12:00', '12:01', '12:15', '23:59']) assert.equal(cronPlan(EVERY_MINUTE_CRON, at(time)), 'dispatch');
});

test('the five minute trigger publishes on the quarter hour and reconciles the reply queue on every other run', () => {
    assert.equal(cronPlan(EVERY_FIVE_MINUTES_CRON, at('12:00')), 'publish');
    assert.equal(cronPlan(EVERY_FIVE_MINUTES_CRON, at('12:15')), 'publish');
    assert.equal(cronPlan(EVERY_FIVE_MINUTES_CRON, at('12:45')), 'publish');
    assert.equal(cronPlan(EVERY_FIVE_MINUTES_CRON, at('12:05')), 'reconcile');
    assert.equal(cronPlan(EVERY_FIVE_MINUTES_CRON, at('12:50')), 'reconcile');
});

test('the daily trigger runs the upkeep and an unknown cron runs nothing', () => {
    assert.equal(cronPlan(DAILY_CRON, at('00:00')), 'daily');
    assert.equal(cronPlan('*/15 * * * *', at('12:15')), 'none');
});

test('the crons in wrangler.toml are the ones the Worker dispatches', () => {
    const toml = readFileSync(new URL('../../wrangler.toml', import.meta.url), 'utf8');
    assert.match(toml, /crons = \["\* \* \* \* \*", "\*\/5 \* \* \* \*", "0 0 \* \* \*"\]/);
    assert.deepEqual([EVERY_MINUTE_CRON, EVERY_FIVE_MINUTES_CRON, DAILY_CRON], ['* * * * *', '*/5 * * * *', '0 0 * * *']);
});

test('a cron run without the Supabase secrets logs which are missing and stops instead of failing', async t => {
    const written = mock.method(console, 'error', () => {});
    t.after(() => written.mock.restore());
    await runScheduledJob(EVERY_MINUTE_CRON, { SUPABASE_URL: 'https://project.supabase.co' } as Env);
    assert.equal(written.mock.callCount(), 1);
    const line = JSON.parse(String(written.mock.calls[0].arguments[0]));
    assert.equal(line.message, 'cron run skipped');
    assert.match(line.reason, /SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY Worker secrets are missing/);
});
