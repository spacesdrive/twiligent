import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export function EmptyState({ icon, title, description, action, className, compact = false }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 text-center',
        compact ? 'px-4 py-8' : 'px-6 py-14',
        className,
      )}
    >
      {icon && (
        <span className="flex size-11 items-center justify-center rounded-card border border-line bg-surface-sunken text-ink-muted [&_svg]:size-5 [&_svg]:stroke-[1.75]">
          {icon}
        </span>
      )}
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-heading text-section font-semibold text-ink">{title}</p>
        {description && <p className="text-small text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ title = 'This page could not load', description, onRetry, className }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-4 px-6 py-14 text-center', className)}>
      <span className="flex size-11 items-center justify-center rounded-card bg-danger-soft text-danger">
        <AlertTriangle className="size-5 stroke-[1.75]" />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-heading text-section font-semibold text-ink">
          <span className="sr-only">Error: </span>{title}
        </p>
        {description && <p className="text-small text-ink-muted">{description}</p>}
      </div>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function LoadingState({ label = 'Loading', className }) {
  return (
    <div role="status" className={cn('flex min-h-[40vh] flex-col items-center justify-center gap-3', className)}>
      <Spinner className="size-6 text-brand" />
      <p className="text-small text-ink-muted">{label}</p>
    </div>
  );
}

// Placeholder that mirrors the real page layout: header, metric row, and a large panel.
export function PageSkeleton({ metrics = 4 }) {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading page">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: metrics }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-card" />
    </div>
  );
}
