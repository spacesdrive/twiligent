import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface MetricBoxProps {
  icon?: React.ReactNode;
  label: React.ReactNode;
  value?: React.ReactNode;
  subtitle?: React.ReactNode;
  loading?: boolean;
  small?: boolean;
  trend?: number;
  trendLabel?: React.ReactNode;
  highlight?: boolean;
  className?: string;
}

// Quiet metric tile: neutral icon, large tabular value, label and one line of context.
export default function MetricBox({
  icon,
  label,
  value,
  subtitle,
  loading,
  small,
  trend,
  trendLabel,
  highlight = false,
  className,
}: MetricBoxProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col gap-3 rounded-card border border-line bg-surface-raised',
        small ? 'p-4' : 'p-5',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-small font-medium text-ink-muted">
          {icon && (
            <span
              className={cn(
                'flex shrink-0 items-center justify-center [&_svg]:size-4 [&_svg]:stroke-[1.75]',
                highlight ? 'text-brand-text' : 'text-ink-faint',
              )}
            >
              {icon}
            </span>
          )}
          <span className="truncate">{label}</span>
        </span>
        {trend !== undefined && !loading && (
          <span className={cn('flex items-center gap-0.5 text-caption font-semibold', trend >= 0 ? 'text-success' : 'text-danger')}>
            {trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className={small ? 'h-6 w-16' : 'h-8 w-24'} />
          <Skeleton className="h-3 w-28" />
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-1">
          <p
            className={cn(
              'font-heading font-semibold tracking-[-0.02em] tabular-nums text-ink leading-none',
              small ? 'text-xl' : 'text-[1.75rem]',
            )}
          >
            {value}
          </p>
          {(subtitle || trendLabel) && (
            <p className="truncate text-caption text-ink-faint">{trendLabel || subtitle}</p>
          )}
        </div>
      )}
    </div>
  );
}
