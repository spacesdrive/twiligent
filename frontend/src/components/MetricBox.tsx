import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { trendTone } from '@/lib/library';

export interface MetricBoxProps {
  icon?: React.ReactNode;
  label: React.ReactNode;
  value?: React.ReactNode;
  subtitle?: React.ReactNode;
  // the time frame the value covers, such as "All time" or "Last 30 days", so a number is never read without one
  period?: string;
  loading?: boolean;
  small?: boolean;
  trend?: number;
  // what the trend compares against, such as "vs last month"
  trendComparison?: string;
  // shown in place of the subtitle, next to a trend
  trendLabel?: React.ReactNode;
  // false for metrics where a rise is bad, so the colour follows the meaning, not the sign
  upIsGood?: boolean;
  highlight?: boolean;
  className?: string;
}

function textOf(node: React.ReactNode): string | undefined {
  return typeof node === 'string' ? node : undefined;
}

// Quiet metric tile: neutral icon, large tabular value, label and one line of context.
export default function MetricBox({
  icon,
  label,
  value,
  subtitle,
  period,
  loading,
  small,
  trend,
  trendComparison,
  trendLabel,
  upIsGood = true,
  highlight = false,
  className,
}: MetricBoxProps) {
  const tone = trend === undefined ? 'neutral' : trendTone(trend, upIsGood);
  const detail = trendLabel ?? subtitle;
  const comparison = trendComparison ?? textOf(trendLabel) ?? '';
  const context = [period, textOf(detail)].filter(Boolean).join(' · ');
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
              aria-hidden="true"
              className={cn(
                'flex shrink-0 items-center justify-center [&_svg]:size-4 [&_svg]:stroke-[1.75]',
                highlight ? 'text-brand-text' : 'text-ink-faint',
              )}
            >
              {icon}
            </span>
          )}
          <span className="truncate" title={textOf(label)}>{label}</span>
        </span>
        {trend !== undefined && !loading && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-caption font-semibold',
              tone === 'good' && 'text-success',
              tone === 'bad' && 'text-danger',
              tone === 'neutral' && 'text-ink-muted',
            )}
          >
            {trend >= 0 ? <TrendingUp className="size-3" aria-hidden="true" /> : <TrendingDown className="size-3" aria-hidden="true" />}
            <span className="sr-only">{trend >= 0 ? 'Up' : 'Down'} </span>
            {Math.abs(trend)}%
            {comparison && <span className="sr-only"> {comparison}</span>}
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
              'font-heading font-semibold tabular-nums text-ink leading-none',
              small ? 'text-page-title' : 'text-metric',
            )}
          >
            {value}
          </p>
          {(period || detail) && (
            <p className="truncate text-caption text-ink-faint" title={context || undefined}>
              {period && <span>{period}</span>}
              {period && detail && <span aria-hidden="true"> · </span>}
              {detail}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
