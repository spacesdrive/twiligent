import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const PALETTE = {
  blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   ring: 'ring-blue-100' },
  red:    { bg: 'bg-red-50',    icon: 'text-red-500',    ring: 'ring-red-100' },
  green:  { bg: 'bg-green-50',  icon: 'text-green-600',  ring: 'ring-green-100' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-500', ring: 'ring-orange-100' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', ring: 'ring-purple-100' },
  teal:   { bg: 'bg-teal-50',   icon: 'text-teal-600',   ring: 'ring-teal-100' },
  pink:   { bg: 'bg-pink-50',   icon: 'text-pink-600',   ring: 'ring-pink-100' },
  indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', ring: 'ring-indigo-100' },
  cyan:   { bg: 'bg-cyan-50',   icon: 'text-cyan-600',   ring: 'ring-cyan-100' },
  amber:  { bg: 'bg-amber-50',  icon: 'text-amber-600',  ring: 'ring-amber-100' },
};

export default function StatCard({
  icon,
  label,
  value,
  subtitle,
  gradient = 'blue',
  loading,
  small,
  trend,
  trendLabel,
}) {
  const pal = PALETTE[gradient] || PALETTE.blue;
  const iconSize = small ? 'h-4 w-4' : 'h-5 w-5';
  const iconBoxSize = small ? 'h-9 w-9' : 'h-11 w-11';

  return (
    <Card className="border border-border shadow-none h-full hover:shadow-sm transition-shadow">
      <CardContent className={cn('flex flex-col gap-3', small ? 'p-4' : 'p-5')}>
        <div className="flex items-start justify-between">
          <div className={cn('rounded-xl flex items-center justify-center flex-shrink-0', iconBoxSize, pal.bg)}>
            {React.isValidElement(icon)
              ? React.cloneElement(icon, { className: cn(iconSize, pal.icon) })
              : icon && <span className={cn(iconSize, pal.icon)}>{icon}</span>}
          </div>
          {trend !== undefined && !loading && (
            <div className="flex items-center gap-0.5">
              {trend >= 0
                ? <TrendingUp className="h-3 w-3 text-green-500" />
                : <TrendingDown className="h-3 w-3 text-red-500" />}
              <span className={cn('text-xs font-semibold', trend >= 0 ? 'text-green-600' : 'text-red-500')}>
                {Math.abs(trend)}%
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <>
            <Skeleton className={cn('rounded', small ? 'h-6 w-16' : 'h-8 w-20')} />
            <Skeleton className="h-3 w-28 rounded" />
          </>
        ) : (
          <div>
            <p className={cn('font-bold tracking-tight leading-none text-foreground', small ? 'text-xl' : 'text-2xl')}>
              {value}
            </p>
            <p className="text-sm text-muted-foreground font-medium mt-1">{label}</p>
            {(subtitle || trendLabel) && (
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {trendLabel || subtitle}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
