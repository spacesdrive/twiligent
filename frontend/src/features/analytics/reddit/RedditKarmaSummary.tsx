import SurfaceBox from '@/components/SurfaceBox';
import { cn } from '@/lib/utils';
import { karmaSummaryOf } from './redditAnalyticsData.ts';

export default function RedditKarmaSummary({ profile }) {
  return (
    <SurfaceBox title="Karma" subheader="Earned across posts and comments">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        {karmaSummaryOf(profile).map(item => (
          <div key={item.label} className="flex flex-col gap-1">
            <span className="text-small font-medium text-ink-muted">{item.label}</span>
            <span className={cn('font-heading text-2xl font-semibold tracking-[-0.02em] tabular-nums', item.lead ? 'text-brand-text' : 'text-ink')}>{item.value}</span>
            <span className="text-caption text-ink-faint">{item.sub}</span>
          </div>
        ))}
      </div>
    </SurfaceBox>
  );
}
