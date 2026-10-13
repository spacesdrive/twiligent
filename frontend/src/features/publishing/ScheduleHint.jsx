import { Link } from 'react-router-dom';

export default function ScheduleHint() {
  return (
    <p className="text-caption text-ink-faint">
      The server publishes the post within 15 minutes after this time, even with this page closed. Keep the account connected until then.{' '}
      <Link to="/settings#scheduling" className="font-medium text-brand-text underline-offset-4 hover:underline">How scheduling works</Link>
    </p>
  );
}
