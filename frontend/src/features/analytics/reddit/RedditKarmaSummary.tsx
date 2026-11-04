import SurfaceBox from '@/components/SurfaceBox';
import Num from '@/components/Num';
import { cn } from '@/lib/utils';
import { karmaSummaryOf } from './redditAnalyticsData.ts';
import type { RedditProfileFields } from './redditAnalyticsData.ts';

export interface RedditKarmaSummaryProps {
  profile: RedditProfileFields;
}

export default function RedditKarmaSummary({ profile }: RedditKarmaSummaryProps) {
  return (
    <SurfaceBox title="Karma" subheader="Earned across posts and comments, all time">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        {karmaSummaryOf(profile).map(item => (
          <div key={item.label} className="flex flex-col gap-1">
            <dt className="text-small font-medium text-ink-muted">{item.label}</dt>
            <dd className={cn('font-heading text-page-title font-semibold tabular-nums', item.lead ? 'text-brand-text' : 'text-ink')}>
              <Num value={item.value} />
            </dd>
            <dd className="text-caption text-ink-faint">{item.sub}</dd>
          </div>
        ))}
      </dl>
    </SurfaceBox>
  );
}
