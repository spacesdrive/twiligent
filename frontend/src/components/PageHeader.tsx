import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// Page title block. One per page; actions sit on the right and wrap under the title on narrow screens.
export default function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  back,
  media,
  size = 'default',
  className,
}) {
  return (
    <header className={cn('flex flex-col gap-4', className)}>
      {back && (
        <Link
          to={back.to}
          className="inline-flex w-fit items-center gap-1.5 rounded-row text-small font-medium text-ink-muted transition-colors duration-(--duration-fast) hover:text-ink"
        >
          <ArrowLeft className="size-4 stroke-[1.75]" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          {media}
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-2 text-brand-text">{eyebrow}</p>}
            <h1
              className={cn(
                'font-heading font-semibold tracking-[-0.01em] text-ink',
                size === 'display' ? 'text-display' : 'text-page-title',
              )}
            >
              {title}
            </h1>
            {description && <div className="mt-1.5 text-sm text-ink-muted">{description}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
