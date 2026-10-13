import { AlertCircle, Calendar, CheckCircle2, ExternalLink, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function PublishResult({ progress, selectedType, selectedAcct, scheduleMode, onReset }) {
  const { publishStatus, statusMessage, publishedMediaId } = progress;

  if (publishStatus === 'done') {
    return (
      <>
        <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-6" /></span>
        <h2 className="font-heading text-page-title font-semibold text-ink">Published</h2>
        <p className="text-sm text-ink-muted">Your {selectedType?.label?.toLowerCase()} is live on Instagram.</p>
        {publishedMediaId && <Badge variant="outline" className="font-mono">Media ID {publishedMediaId}</Badge>}
        <div className="mt-2 flex gap-2">
          <Button onClick={onReset}><Plus data-icon="inline-start" />Publish another</Button>
          {selectedAcct?.username && (
            <Button variant="outline" render={<a href={`https://instagram.com/${selectedAcct.username}`} target="_blank" rel="noopener noreferrer" />}>
              <ExternalLink data-icon="inline-start" />View profile
            </Button>
          )}
        </div>
      </>
    );
  }

  if (publishStatus === 'scheduled') {
    return (
      <>
        <span className="flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning"><Calendar className="size-6" /></span>
        <h2 className="font-heading text-page-title font-semibold text-ink">Post scheduled</h2>
        <p className="text-sm text-ink-muted">{statusMessage}</p>
        <p className="max-w-md text-small text-ink-faint">The server publishes it within 15 minutes after that time, even when this browser is closed. Track it under Scheduled posts below.</p>
        <Button onClick={onReset} className="mt-2"><Plus data-icon="inline-start" />Schedule another</Button>
      </>
    );
  }

  if (publishStatus !== 'error') return null;

  return (
    <>
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger"><AlertCircle className="size-6" /></span>
      <h2 className="font-heading text-page-title font-semibold text-ink"><span className="sr-only">Error: </span>{scheduleMode ? 'Scheduling failed' : 'Publishing failed'}</h2>
      <p className="max-w-md text-sm text-ink-muted">{statusMessage}</p>
      <div className="mt-2 flex gap-2">
        <Button onClick={progress.retry}>Try again</Button>
        <Button variant="outline" onClick={onReset}>Start over</Button>
      </div>
    </>
  );
}
