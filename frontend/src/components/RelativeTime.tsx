import { fmtDateTime, timeAgo } from '@/utils/formatters';
import type { DateLike } from '@/utils/formatters';

export interface RelativeTimeProps {
  date: DateLike;
  prefix?: string;
  className?: string;
}

// a recent age reads faster as "2h ago"; the exact date and time stay on hover and are read aloud
export default function RelativeTime({ date, prefix = '', className }: RelativeTimeProps) {
  if (!date) return <span className={className}>{prefix}{timeAgo(date)}</span>;
  const exact = fmtDateTime(date);
  return (
    <time dateTime={new Date(date).toISOString()} title={exact} className={className}>
      <span aria-hidden="true">{prefix}{timeAgo(date)}</span>
      <span className="sr-only">{prefix}{exact}</span>
    </time>
  );
}
