import { isShort } from '../shorts/shortsLibrary.ts';
import type { StackedPoint } from '../../../lib/stackedBars.ts';
import type { LibraryVideo } from './videoLibrary.ts';

export type UploadPeriod = 'month' | 'week';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;

// weeks start on Monday, in the viewer's own time zone, like the schedule pickers
function weekStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function periodStarts(period: UploadPeriod, count: number, now: Date): Date[] {
  if (period === 'month') {
    return Array.from({ length: count }, (_, index) => new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1));
  }
  const current = weekStart(now);
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(current);
    start.setDate(current.getDate() - 7 * (count - 1 - index));
    return start;
  });
}

function labelsOf(period: UploadPeriod, start: Date): { label: string; short: string } {
  const month = MONTHS[start.getMonth()];
  if (period === 'month') return { label: `${month} ${start.getFullYear()}`, short: month };
  const end = new Date(start.getTime() + 6 * DAY_MS);
  const endText = end.getMonth() === start.getMonth() ? `${end.getDate()}` : `${MONTHS[end.getMonth()]} ${end.getDate()}`;
  return { label: `${month} ${start.getDate()} to ${endText}`, short: `${month} ${start.getDate()}` };
}

// uploads in each of the last `count` months or weeks, the current one last, split into regular videos and Shorts
export function uploadsByPeriod(videos: LibraryVideo[], period: UploadPeriod, count: number, now = new Date()): StackedPoint[] {
  const starts = periodStarts(period, count, now);
  const counts = starts.map(() => [0, 0]);
  for (const video of videos) {
    const published = new Date(video.publishedAt);
    if (Number.isNaN(published.getTime())) continue;
    let index = -1;
    for (let candidate = starts.length - 1; candidate >= 0; candidate--) {
      if (published >= starts[candidate]) { index = candidate; break; }
    }
    if (index === -1 || published > now) continue;
    counts[index][isShort(video) ? 1 : 0] += 1;
  }
  return starts.map((start, index) => ({ ...labelsOf(period, start), values: counts[index] }));
}
