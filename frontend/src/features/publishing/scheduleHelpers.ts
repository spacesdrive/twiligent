export const OVERDUE_MS = 30 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, '0');
}

export function scheduledStatusChips(posts) {
  const countOf = status => posts.filter(post => post.status === status).length;
  return [
    { value: 'all',        label: 'All',        count: posts.length },
    { value: 'pending',    label: 'Pending',    count: countOf('pending') },
    { value: 'publishing', label: 'Publishing', count: countOf('publishing') },
    { value: 'published',  label: 'Published',  count: countOf('published') },
    { value: 'failed',     label: 'Failed',     count: countOf('failed') },
  ];
}

export function filterScheduledPosts(posts, statusFilter) {
  return posts
    .filter(post => statusFilter === 'all' || post.status === statusFilter)
    .sort((first, second) => new Date(second.scheduledAt) - new Date(first.scheduledAt));
}

export function overduePostsOf(posts, now = Date.now()) {
  return posts.filter(post => post.status === 'pending' && now - new Date(post.scheduledAt).getTime() > OVERDUE_MS);
}

export function isPastDue(post, now = new Date()) {
  return post.status === 'pending' && new Date(post.scheduledAt) < now;
}

export function overdueLead(count) {
  if (count === 1) return '1 post is';
  return `${count} posts are`;
}

export function deleteAllMessage(deleted) {
  const suffix = deleted === 1 ? '' : 's';
  return `Deleted ${deleted} post${suffix}`;
}

export function formatScheduleDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function toLocalDateInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toLocalTimeInput(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// known issue: date inputs use the UTC calendar day, not the local one
export function utcDateInput(date = new Date()) {
  return date.toISOString().split('T')[0];
}

export function defaultBulkStartDate(now = new Date()) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return utcDateInput(tomorrow);
}

export function goesLiveLabel({ scheduleMode, scheduleDate, scheduleTime }) {
  if (!scheduleMode) return 'Right away';
  if (!scheduleDate || !scheduleTime) return 'Pick a time';
  return new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString();
}
