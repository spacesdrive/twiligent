import { Clock, Star, TrendingUp, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { fmtNum } from '../../../utils/formatters';
import type { InstagramAnalytics } from '@shared/types/instagram.ts';

interface InsightChipProps {
  icon: LucideIcon;
  children: ReactNode;
}

function InsightChip({ icon, children }: InsightChipProps) {
  const Icon = icon;
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-field border border-line bg-surface px-3 text-small font-medium text-ink">
      <Icon className="size-3.5 stroke-[1.75] text-ink-faint" />
      {children}
    </span>
  );
}

export interface InstagramInsightChipsProps {
  analytics: Partial<InstagramAnalytics>;
}

export default function InstagramInsightChips({ analytics }: InstagramInsightChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {analytics.bestPostingDay && <InsightChip icon={Star}>Best day: {analytics.bestPostingDay}</InsightChip>}
      {analytics.bestPostingHour && <InsightChip icon={Clock}>Best hour: {analytics.bestPostingHour}</InsightChip>}
      <InsightChip icon={TrendingUp}>Average engagement: {fmtNum(analytics.avgEngagement || 0)} per post</InsightChip>
      <InsightChip icon={Trophy}>Consistency: {analytics.consistencyScore || 0}/100</InsightChip>
    </div>
  );
}
