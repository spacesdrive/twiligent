import MetricBox from '@/components/MetricBox';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { countLabel, pluralize } from './trackedList.ts';
import type { TrackedStats } from './trackedList.ts';

const { tracked: Tracked, category: Category, videos: Videos, redditPosts: Posts } = METRIC_ICONS;

function categoriesSubtitle(count: number): string {
  if (count === 0) return 'None assigned yet';
  return countLabel(count, 'group');
}

function trackedSubtitle(count: number, emptyText: string, word: string): string {
  if (count === 0) return emptyText;
  return `${pluralize(count, word)} tracked`;
}

export interface TrackedMetricsProps {
  stats: TrackedStats;
}

export default function TrackedMetrics({ stats }: TrackedMetricsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricBox icon={<Tracked />}  label="Tracked items" value={stats.total}      subtitle="Across all categories" highlight />
      <MetricBox icon={<Category />} label="Categories"    value={stats.categories} subtitle={categoriesSubtitle(stats.categories)} />
      <MetricBox icon={<Videos />}   label="YouTube"       value={stats.youtube}    subtitle={trackedSubtitle(stats.youtube, 'No videos tracked', 'Video')} />
      <MetricBox icon={<Posts />}    label="Reddit"        value={stats.reddit}     subtitle={trackedSubtitle(stats.reddit, 'No posts tracked', 'Post')} />
    </div>
  );
}
