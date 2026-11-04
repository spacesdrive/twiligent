import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDeferredActions } from '../../src/lib/deferredActions.ts';

test('a scheduled action runs once its delay has passed', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const actions = createDeferredActions();
  let ran = 0;
  actions.schedule('rule-1', 8000, () => { ran++; });
  t.mock.timers.tick(7999);
  assert.equal(ran, 0);
  t.mock.timers.tick(1);
  await Promise.resolve();
  assert.equal(ran, 1);
  assert.equal(actions.pending(), 0);
});

test('cancelling before the delay means the action never runs', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const actions = createDeferredActions();
  let ran = 0;
  actions.schedule('rule-1', 8000, () => { ran++; });
  assert.equal(actions.cancel('rule-1'), true);
  t.mock.timers.tick(8000);
  await Promise.resolve();
  assert.equal(ran, 0);
  assert.equal(actions.cancel('rule-1'), false);
});

test('flushing runs every waiting action at once', async () => {
  const actions = createDeferredActions();
  const ran: string[] = [];
  actions.schedule('a', 60_000, () => { ran.push('a'); });
  actions.schedule('b', 60_000, () => { ran.push('b'); });
  await actions.flush();
  assert.deepEqual(ran.sort(), ['a', 'b']);
  assert.equal(actions.pending(), 0);
});
