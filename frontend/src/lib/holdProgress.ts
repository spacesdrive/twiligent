// Timing core for hold-to-confirm. The clock and frame scheduler are injected so tests can drive time.

export const DEFAULT_HOLD_MS = 1200;

export interface HoldControllerOptions {
  duration?: number;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  now?: () => number;
  requestFrame?: (callback: () => void) => number;
  cancelFrame?: (id: number) => void;
}

export function createHoldController({
  duration = DEFAULT_HOLD_MS,
  onProgress = () => {},
  onComplete = () => {},
  now = () => performance.now(),
  requestFrame = cb => requestAnimationFrame(cb),
  cancelFrame = id => cancelAnimationFrame(id),
}: HoldControllerOptions = {}) {
  let startedAt: number | null = null;
  let frame: number | null = null;
  let done = false;

  function tick() {
    if (startedAt === null) return;
    const progress = Math.min(1, (now() - startedAt) / duration);
    onProgress(progress);
    if (progress >= 1) {
      startedAt = null;
      frame = null;
      done = true;
      onComplete();
      return;
    }
    frame = requestFrame(tick);
  }

  return {
    start() {
      if (startedAt !== null || done) return;
      startedAt = now();
      onProgress(0);
      frame = requestFrame(tick);
    },
    // Releasing early resets progress; nothing fires
    cancel() {
      if (frame !== null) cancelFrame(frame);
      frame = null;
      if (startedAt !== null) onProgress(0);
      startedAt = null;
    },
    reset() {
      this.cancel();
      done = false;
      onProgress(0);
    },
    get holding() {
      return startedAt !== null;
    },
    get completed() {
      return done;
    },
  };
}
