import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAILY_CRON, EVERY_FIVE_MINUTES_CRON, cronPlan } from '../../jobs/scheduled.ts';

const at = (time: string) => Date.parse(`2026-10-16T${time}:00Z`);

test('the five minute trigger publishes on the quarter hour and sweeps the reply queue on every other run', () => {
    assert.equal(cronPlan(EVERY_FIVE_MINUTES_CRON, at('12:00')), 'publish_then_sweep');
    assert.equal(cronPlan(EVERY_FIVE_MINUTES_CRON, at('12:15')), 'publish_then_sweep');
    assert.equal(cronPlan(EVERY_FIVE_MINUTES_CRON, at('12:45')), 'publish_then_sweep');
    assert.equal(cronPlan(EVERY_FIVE_MINUTES_CRON, at('12:05')), 'sweep');
    assert.equal(cronPlan(EVERY_FIVE_MINUTES_CRON, at('12:50')), 'sweep');
});

test('the daily trigger runs the upkeep and an unknown cron runs nothing', () => {
    assert.equal(cronPlan(DAILY_CRON, at('00:00')), 'daily');
    assert.equal(cronPlan('*/15 * * * *', at('12:15')), 'none');
});

test('the crons in wrangler.toml are the ones the Worker dispatches', () => {
    const toml = readFileSync(new URL('../../wrangler.toml', import.meta.url), 'utf8');
    assert.match(toml, /crons = \["\*\/5 \* \* \* \*", "0 0 \* \* \*"\]/);
    assert.deepEqual([EVERY_FIVE_MINUTES_CRON, DAILY_CRON], ['*/5 * * * *', '0 0 * * *']);
});
