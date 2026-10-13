import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHoldController } from './holdProgress.js';

// A manual clock and frame queue so timing can be stepped deterministically
function harness(duration = 1000) {
  let now = 0;
  let queue = [];
  const progress = [];
  let completed = 0;
  const controller = createHoldController({
    duration,
    now: () => now,
    requestFrame: cb => { queue.push(cb); return queue.length; },
    cancelFrame: () => { queue = []; },
    onProgress: p => progress.push(p),
    onComplete: () => { completed++; },
  });
  const advance = ms => {
    now += ms;
    const pending = queue;
    queue = [];
    pending.forEach(cb => cb());
  };
  return { controller, advance, progress, get completed() { return completed; } };
}

test('a full hold confirms exactly once', () => {
  const h = harness(1000);
  h.controller.start();
  h.advance(400);
  h.advance(400);
  assert.equal(h.completed, 0);
  h.advance(400);
  assert.equal(h.completed, 1);
  assert.equal(h.progress.at(-1), 1);
  h.advance(400);
  assert.equal(h.completed, 1, 'no further ticks after completion');
});

test('releasing early cancels and resets progress', () => {
  const h = harness(1000);
  h.controller.start();
  h.advance(500);
  h.controller.cancel();
  assert.equal(h.progress.at(-1), 0);
  h.advance(2000);
  assert.equal(h.completed, 0);
  assert.equal(h.controller.holding, false);
});

test('a quick click never confirms', () => {
  const h = harness(1200);
  h.controller.start();
  h.advance(16);
  h.controller.cancel();
  h.advance(5000);
  assert.equal(h.completed, 0);
});

test('starting twice does not restart the timer', () => {
  const h = harness(1000);
  h.controller.start();
  h.advance(600);
  h.controller.start();
  h.advance(500);
  assert.equal(h.completed, 1);
});

test('a completed controller ignores new holds until reset', () => {
  const h = harness(100);
  h.controller.start();
  h.advance(150);
  assert.equal(h.controller.completed, true);
  h.controller.start();
  h.advance(150);
  assert.equal(h.completed, 1);
  h.controller.reset();
  h.controller.start();
  h.advance(150);
  assert.equal(h.completed, 2);
});
