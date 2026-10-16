import { AlertCircle, PauseCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { docsUrl } from '@/lib/docs';
import type { AutomationSettings } from '@shared/types/automation.ts';

interface AutomationNoticesProps {
  settings: AutomationSettings;
}

// what the server is missing or holding back, before any rule can reply
export default function AutomationNotices({ settings }: AutomationNoticesProps) {
  return (
    <>
      {!settings.webhookConfigured && (
        <Alert variant="warning">
          <AlertCircle />
          <AlertTitle>Comment events are not set up on this server</AlertTitle>
          <AlertDescription>
            Rules can be written, but no comment reaches Twiligent until the INSTAGRAM_WEBHOOK_VERIFY_TOKEN and INSTAGRAM_APP_SECRET Worker
            secrets are set and the webhook is added in the Meta dashboard. Follow{' '}
            <a href={docsUrl('/self-host/comment-automation')} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
              Comment automation setup
            </a>.
          </AlertDescription>
        </Alert>
      )}
      {settings.paused && (
        <Alert variant="info">
          <PauseCircle />
          <AlertTitle>Replies are paused on this server</AlertTitle>
          <AlertDescription>
            Comments are still recorded, but nothing is sent while the AUTOMATION_PAUSED Worker variable is true. Replies go out once it is
            removed, if the comment is still under Instagram&apos;s 7 days.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
