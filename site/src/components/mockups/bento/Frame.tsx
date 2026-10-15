import type { ReactNode, Ref } from 'react';
import { cn } from '@/lib/cn';

export interface FrameProps {
  // the whole picture's description; the card reads as one image
  label: string;
  ref?: Ref<HTMLDivElement>;
  icon: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  bodyClassName?: string;
  // drawn over the whole frame, such as a cursor measuring its targets against the frame
  overlay?: ReactNode;
  children: ReactNode;
}

// a small app window for a bento card: a title bar, then content that fills the panel and runs off its lower edge
export function Frame({ label, ref, icon, title, meta, bodyClassName, overlay, children }: FrameProps) {
  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className="relative mx-auto flex min-h-[21rem] w-full max-w-[27rem] flex-1 flex-col overflow-hidden rounded-t-lg border border-b-0 border-line bg-surface-raised shadow-window"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
        <span className="flex shrink-0 text-ink-muted">{icon}</span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{title}</p>
        {meta}
      </div>
      {/* laid out on its own so a long list fills the frame and is cut off by it, without making the row taller */}
      <div className="relative min-h-0 flex-1">
        <div className={cn('absolute inset-0', bodyClassName)}>{children}</div>
      </div>
      {overlay}
    </div>
  );
}
