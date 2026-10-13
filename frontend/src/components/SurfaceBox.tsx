import React from 'react';
import { cn } from '@/lib/utils';

export interface SurfaceBoxProps extends Omit<React.ComponentProps<'section'>, 'title' | 'content'> {
  children?: React.ReactNode;
  title?: React.ReactNode;
  subheader?: React.ReactNode;
  secondary?: React.ReactNode;
  content?: boolean;
  contentClassName?: string;
  className?: string;
  noPadding?: boolean;
}

// the one container for grouped content; without a title it is a plain panel
export default function SurfaceBox({
  children,
  title,
  subheader,
  secondary,
  content = true,
  contentClassName = '',
  className = '',
  noPadding = false,
  ...props
}: SurfaceBoxProps) {
  return (
    <section
      className={cn('flex flex-col rounded-card border border-line bg-surface-raised text-ink', className)}
      {...props}
    >
      {title && (
        <header className="flex items-start justify-between gap-4 border-b border-divider px-5 py-4">
          <div className="min-w-0">
            <h3 className="font-heading text-section font-semibold">{title}</h3>
            {subheader && <p className="mt-0.5 text-small text-ink-muted">{subheader}</p>}
          </div>
          {secondary && <div className="shrink-0">{secondary}</div>}
        </header>
      )}
      {content ? (
        <div className={cn('px-5 py-4', noPadding && 'p-0', contentClassName)}>{children}</div>
      ) : (
        children
      )}
    </section>
  );
}
