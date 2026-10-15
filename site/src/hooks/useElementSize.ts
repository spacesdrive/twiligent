import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export interface Size {
  width: number;
  height: number;
}

// an element's content size, kept current as it resizes; zero until the first measurement
export function useElementSize(ref: RefObject<Element | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize(current => (current.width === width && current.height === height ? current : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
