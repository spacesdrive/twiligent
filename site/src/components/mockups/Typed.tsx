import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';

export interface TypedProps {
  text: string;
  // starts typing; give the component a new key to type from the start again
  active: boolean;
  // characters a second, about the pace measured on the Activepieces prompt
  speed?: number;
  caret?: boolean;
  // draws the typed part, for text with highlighted words
  render?: (typed: string) => ReactNode;
}

// text typed out a few characters at a time, with a blinking caret while it types
export function Typed({ text, active, speed = 18, caret = true, render }: TypedProps) {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active || reduce) return;
    const timer = window.setInterval(() => {
      setCount(current => {
        if (current >= text.length) window.clearInterval(timer);
        return Math.min(text.length, current + 2);
      });
    }, 2000 / speed);
    return () => window.clearInterval(timer);
  }, [active, reduce, text, speed]);

  const shown = reduce ? text.length : count;
  const typing = active && !reduce && shown < text.length;
  return (
    <>
      {render ? render(text.slice(0, shown)) : text.slice(0, shown)}
      {caret && typing && (
        <span className="caret ml-px inline-block h-[1.05em] w-[1.5px] translate-y-[0.15em] bg-ink" />
      )}
    </>
  );
}
