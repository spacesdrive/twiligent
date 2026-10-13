import React from 'react';
import { cn } from '@/lib/utils';

// Side panel for a working surface: sticky on wide screens, stacked below the main area on narrow ones.
export default function DetailPanel({ title, description, children, footer, className }) {
  return (
    <aside
      className={cn(
        'flex flex-col rounded-card border border-line bg-surface-raised lg:sticky lg:top-[calc(var(--topbar-h)+1.5rem)] lg:max-h-[calc(100dvh-var(--topbar-h)-3rem)]',
        className,
      )}
    >
      {title && (
        <div className="border-b border-divider px-5 py-4">
          <h2 className="font-heading text-section font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-small text-ink-muted">{description}</p>}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">{children}</div>
      {footer && <div className="border-t border-divider px-5 py-4">{footer}</div>}
    </aside>
  );
}

// Label, hint and control in one settings-style row.
export function FieldRow({ label, hint, htmlFor, children, className }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-col gap-0.5">
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink">{label}</label>
        {hint && <p className="text-caption text-ink-faint">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
