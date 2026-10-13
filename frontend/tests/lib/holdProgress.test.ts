import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHoldController } from '../../src/lib/holdProgress.ts';

// A manual clock and frame queue so timing can be stepped deterministically
function harness(duration = 1000) {
  let now = 0;
  let queue: Array<() => void> = [];
  const progress: number[] = [];
  let completed = 0;
  const controller = createHoldController({
    duration,
    now: () => now,
    requestFrame: cb => { queue.push(cb); return queue.length; },
    cancelFrame: () => { queue = []; },
    onProgress: p => progress.push(p),
    onComplete: () => { completed++; },
  });
  const advance = (ms: number) => {
    now += ms;
    const pending = queue;
    queue = [];
    pending.forEach(cb => cb());
  };
  return { controller, advance, progress, get completed() { return completed; } };
}

test('a full hold confirms exactly once', () => {
  const hold = harness(1000);
  hold.controller.start();
  hold.advance(400);
  hold.advance(400);
  assert.equal(hold.completed, 0);
  hold.advance(400);
  assert.equal(hold.completed, 1);
  assert.equal(hold.progress.at(-1), 1);
  hold.advance(400);
  assert.equal(hold.completed, 1, 'no further ticks after completion');
});

test('releasing early cancels and resets progress', () => {
  const hold = harness(1000);
  hold.controller.start();
  hold.advance(500);
  hold.controller.cancel();
  assert.equal(hold.progress.at(-1), 0);
  hold.advance(2000);
  assert.equal(hold.completed, 0);
  assert.equal(hold.controller.holding, false);
});

test('a quick click never confirms', () => {
  const hold = harness(1200);
  hold.controller.start();
  hold.advance(16);
  hold.controller.cancel();
  hold.advance(5000);
  assert.equal(hold.completed, 0);
});

test('starting twice does not restart the timer', () => {
  const hold = harness(1000);
  hold.controller.start();
  hold.advance(600);
  hold.controller.start();
  hold.advance(500);
  assert.equal(hold.completed, 1);
});

test('a completed controller ignores new holds until reset', () => {
  const hold = harness(100);
  hold.controller.start();
  hold.advance(150);
  assert.equal(hold.controller.completed, true);
  hold.controller.start();
  hold.advance(150);
  assert.equal(hold.completed, 1);
  hold.controller.reset();
  hold.controller.start();
  hold.advance(150);
  assert.equal(hold.completed, 2);
});
