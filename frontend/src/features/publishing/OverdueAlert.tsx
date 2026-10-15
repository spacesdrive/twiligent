import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ADMIN_EMAIL, adminMailto } from '@/lib/contact';
import { overdueLead } from './scheduleHelpers.ts';

interface OverdueAlertProps {
  count: number;
}

export default function OverdueAlert({ count }: OverdueAlertProps) {
  return (
    <Alert variant="warning">
      <AlertCircle />
      <AlertDescription>
        {overdueLead(count)} more than 30 minutes late and not yet published, so the scheduler on this server is not running. Email the administrator at{' '}
        <a href={adminMailto('Scheduled posts are not publishing on Twiligent')} className="font-semibold underline underline-offset-4">{ADMIN_EMAIL}</a>.
        If you run this instance, follow the checks in <Link to="/settings#scheduling" className="font-semibold underline underline-offset-4">Settings, Scheduled publishing</Link>.
      </AlertDescription>
    </Alert>
  );
}
