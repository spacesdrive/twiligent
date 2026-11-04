import { Link } from 'react-router-dom';

export default function ScheduleHint() {
  return (
    <p className="max-w-prose text-small text-ink-muted">
      The server publishes the post within 15 minutes after this time, even with this page closed. Keep the account connected until then.{' '}
      <Link to="/settings#scheduling" className="font-medium text-brand-text underline underline-offset-4">How scheduling works</Link>
    </p>
  );
}
