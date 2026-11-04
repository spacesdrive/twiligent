import MetricBox from '@/components/MetricBox';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { countLabel, pluralize } from './trackedList.ts';
import type { TrackedStats } from './trackedList.ts';

const { tracked: Tracked, category: Category, regularVideos: Videos, shorts: Shorts } = METRIC_ICONS;

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
      <MetricBox icon={<Tracked />}  label="Tracked videos" value={stats.total}      subtitle="Across all categories" highlight />
      <MetricBox icon={<Category />} label="Categories"     value={stats.categories} subtitle={categoriesSubtitle(stats.categories)} />
      <MetricBox icon={<Videos />}   label="Videos"         value={stats.videos}     subtitle={trackedSubtitle(stats.videos, 'No videos tracked', 'Video')} />
      <MetricBox icon={<Shorts />}   label="Shorts"         value={stats.shorts}     subtitle={trackedSubtitle(stats.shorts, 'No Shorts tracked', 'Short')} />
    </div>
  );
}
