import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { animate, motion, useMotionValue } from 'motion/react';

export interface CursorProps {
  // the picture the cursor moves over; targets inside it carry data-cursor="<name>"
  stage: RefObject<HTMLElement | null>;
  target: string | null;
  // goes up by one for each click, so the same target can be clicked twice
  clicks: number;
}

// glide and press timings measured from the Activepieces product pictures
const GLIDE = { duration: 0.72, ease: [0.5, 0.02, 0.2, 1] as const };
const FADE = { duration: 0.26 };

// where the pointer's tip rests on a target, as a share of its width and height
const TIP: [number, number] = [0.58, 0.62];

function locate(stage: HTMLElement, name: string): [number, number] | null {
  const el = stage.querySelector<HTMLElement>(`[data-cursor="${name}"]`);
  if (!el) return null;
  const s = stage.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return [r.left - s.left + r.width * TIP[0], r.top - s.top + r.height * TIP[1]];
}

// a pointer that glides between named targets in a picture and clicks them, hidden while target is null
export function Cursor({ stage, target, clicks }: CursorProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const opacity = useMotionValue(0);
  const glyph = useRef<SVGSVGElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const shown = useRef(false);

  useLayoutEffect(() => {
    const el = stage.current;
    const spot = el && target ? locate(el, target) : null;
    if (!spot) {
      shown.current = false;
      animate(opacity, 0, FADE);
      return;
    }
    // the first stop after being hidden is where the cursor appears, not somewhere it travels to
    if (shown.current) {
      animate(x, spot[0], GLIDE);
      animate(y, spot[1], GLIDE);
    } else {
      x.jump(spot[0]);
      y.jump(spot[1]);
      animate(opacity, 1, FADE);
      shown.current = true;
    }
  }, [stage, target, x, y, opacity]);

  useEffect(() => {
    if (clicks === 0 || !glyph.current || !ring.current) return;
    animate(glyph.current, { scale: [1, 0.82, 1] }, { duration: 0.26, times: [0, 0.5, 1] });
    animate(ring.current, { scale: [0.35, 1.9], opacity: [0.5, 0] }, { duration: 0.48, ease: 'easeOut' });
  }, [clicks]);

  return (
    <motion.div aria-hidden="true" className="pointer-events-none absolute top-0 left-0 z-30" style={{ x, y, opacity }}>
      <span
        ref={ring}
        className="absolute -top-1.5 -left-1.5 size-5 rounded-full border-[1.5px] border-ink-muted opacity-0"
      />
      <svg ref={glyph} width="22" height="24" viewBox="0 0 22 24" className="origin-[3px_2px] drop-shadow-md">
        <path
          d="M2.5 1.75 V18.6 L7 14.55 L10.15 21.6 L13.35 20.2 L10.3 13.3 H16.6 Z"
          className="fill-dusk stroke-paper"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}
