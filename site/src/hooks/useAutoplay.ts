import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { useInView, useReducedMotion } from 'motion/react';

export interface Autoplay {
  phase: number;
  // counts finished loops, so a part that must start fresh each time can take it as its key
  loop: number;
  playing: boolean;
  reduce: boolean;
}

// steps a mockup through its phases while it is on screen: durations[n] is how long phase n holds, in seconds;
// the last phase holds, then the story loops; under reduced motion the mockup shows its last phase and stays there
export function useAutoplay(ref: RefObject<Element | null>, durations: number[]): Autoplay {
  const reduce = useReducedMotion() ?? false;
  const inView = useInView(ref, { amount: 0.35 });
  const last = durations.length - 1;
  const [state, setState] = useState({ phase: 0, loop: 0 });
  const playing = !reduce && inView;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(
      () => setState(s => (s.phase >= last ? { phase: 0, loop: s.loop + 1 } : { phase: s.phase + 1, loop: s.loop })),
      durations[state.phase] * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [playing, state.phase, last, durations]);

  return { phase: reduce ? last : state.phase, loop: state.loop, playing, reduce };
}
