import type { PostStatus, ScheduledPost } from '../../../../shared/types/domain.ts';

export type StatusFilter = 'all' | PostStatus;

export interface StatusChip {
  value: StatusFilter;
  label: string;
  count: number;
}

export type ScheduleTiming = Pick<ScheduledPost, 'status' | 'scheduledAt'>;

export interface ScheduleFieldValues {
  scheduleMode: boolean;
  scheduleDate: string;
  scheduleTime: string;
}

export const OVERDUE_MS = 30 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function scheduledStatusChips(posts: readonly ScheduleTiming[]): StatusChip[] {
  const countOf = (status: PostStatus) => posts.filter(post => post.status === status).length;
  return [
    { value: 'all',        label: 'All',        count: posts.length },
    { value: 'pending',    label: 'Pending',    count: countOf('pending') },
    { value: 'publishing', label: 'Publishing', count: countOf('publishing') },
    { value: 'published',  label: 'Published',  count: countOf('published') },
    { value: 'failed',     label: 'Failed',     count: countOf('failed') },
  ];
}

export function filterScheduledPosts<T extends ScheduleTiming>(posts: T[], statusFilter: StatusFilter): T[] {
  return posts
    .filter(post => statusFilter === 'all' || post.status === statusFilter)
    .sort((first, second) => (new Date(second.scheduledAt) as unknown as number) - (new Date(first.scheduledAt) as unknown as number));
}

export function overduePostsOf<T extends ScheduleTiming>(posts: T[], now: number = Date.now()): T[] {
  return posts.filter(post => post.status === 'pending' && now - new Date(post.scheduledAt).getTime() > OVERDUE_MS);
}

export function isPastDue(post: ScheduleTiming, now: Date = new Date()): boolean {
  return post.status === 'pending' && new Date(post.scheduledAt) < now;
}

export function overdueLead(count: number): string {
  if (count === 1) return '1 post is';
  return `${count} posts are`;
}

export function deleteAllMessage(deleted: number): string {
  const suffix = deleted === 1 ? '' : 's';
  return `Deleted ${deleted} post${suffix}`;
}

export function formatScheduleDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function toLocalDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toLocalTimeInput(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// known issue: date inputs use the UTC calendar day, not the local one
export function utcDateInput(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export function defaultBulkStartDate(now: Date = new Date()): string {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return utcDateInput(tomorrow);
}

export function goesLiveLabel({ scheduleMode, scheduleDate, scheduleTime }: ScheduleFieldValues): string {
  if (!scheduleMode) return 'Right away';
  if (!scheduleDate || !scheduleTime) return 'Pick a time';
  return new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString();
}
