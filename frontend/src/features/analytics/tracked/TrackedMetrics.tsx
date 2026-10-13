import { BookmarkCheck, CirclePlay, MessagesSquare, Tag } from 'lucide-react';
import MetricBox from '@/components/MetricBox';
import { countLabel, pluralize } from './trackedList.ts';
import type { TrackedStats } from './trackedList.ts';

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
      <MetricBox icon={<BookmarkCheck />}  label="Tracked items" value={stats.total}      subtitle="Across all categories" highlight />
      <MetricBox icon={<Tag />}            label="Categories"    value={stats.categories} subtitle={categoriesSubtitle(stats.categories)} />
      <MetricBox icon={<CirclePlay />}     label="YouTube"       value={stats.youtube}    subtitle={trackedSubtitle(stats.youtube, 'No videos tracked', 'Video')} />
      <MetricBox icon={<MessagesSquare />} label="Reddit"        value={stats.reddit}     subtitle={trackedSubtitle(stats.reddit, 'No posts tracked', 'Post')} />
    </div>
  );
}
