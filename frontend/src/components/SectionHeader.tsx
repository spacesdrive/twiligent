import React from 'react';
import { cn } from '@/lib/utils';

export default function SectionHeader({ title, description, actions, className }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="font-heading text-section font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-small text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
