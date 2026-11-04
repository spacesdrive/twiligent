import { useReducedMotion } from 'motion/react';
import { useMotionPaused } from '@/lib/motion';

// true when the reader asked for less motion, in the system settings or with the site's pause control
export function useStillMotion(): boolean {
  const reduce = useReducedMotion() ?? false;
  const [paused] = useMotionPaused();
  return reduce || paused;
}
