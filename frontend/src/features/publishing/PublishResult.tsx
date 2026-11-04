import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, Calendar, CheckCircle2, ExternalLink, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AppAccount } from '../../utils/formatters';
import type { ContentTypeOption } from './publishConstants';
import type { PublishProgressState } from './usePublishProgress';

export interface PublishResultProps {
  progress: PublishProgressState;
  selectedType: ContentTypeOption | undefined;
  selectedAcct: AppAccount | undefined;
  scheduleMode: boolean;
  onReset: () => void;
}

// the form that held focus is gone, so the outcome's heading takes it and a screen reader reads the result
function ResultHeading({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return <h2 ref={ref} tabIndex={-1} className="font-heading text-section font-semibold text-ink outline-none">{children}</h2>;
}

export default function PublishResult({ progress, selectedType, selectedAcct, scheduleMode, onReset }: PublishResultProps) {
  const { publishStatus, statusMessage, publishedMediaId } = progress;

  if (publishStatus === 'done') {
    return (
      <>
        <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-6" aria-hidden="true" /></span>
        <ResultHeading>Published</ResultHeading>
        <p className="text-sm text-ink-muted">Your {selectedType?.label?.toLowerCase()} is live on Instagram.</p>
        {publishedMediaId && <Badge variant="outline" className="font-mono">Media ID {publishedMediaId}</Badge>}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button onClick={onReset}><Plus data-icon="inline-start" />Publish another</Button>
          {selectedAcct?.username && (
            <Button variant="outline" render={<a href={`https://instagram.com/${selectedAcct.username}`} target="_blank" rel="noopener noreferrer" />}>
              <ExternalLink data-icon="inline-start" />View profile<span className="sr-only"> (opens in a new tab)</span>
            </Button>
          )}
        </div>
      </>
    );
  }

  if (publishStatus === 'scheduled') {
    return (
      <>
        <span className="flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning"><Calendar className="size-6" aria-hidden="true" /></span>
        <ResultHeading>Post scheduled</ResultHeading>
        <p className="text-sm text-ink-muted">{statusMessage}</p>
        <p className="max-w-md text-small text-ink-muted">The server publishes it within 15 minutes after that time, even when this browser is closed. Track it under Scheduled posts below.</p>
        <Button onClick={onReset} className="mt-2"><Plus data-icon="inline-start" />Schedule another</Button>
      </>
    );
  }

  if (publishStatus !== 'error') return null;

  return (
    <>
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger"><AlertCircle className="size-6" aria-hidden="true" /></span>
      <ResultHeading><span className="sr-only">Error: </span>{scheduleMode ? 'Scheduling failed' : 'Publishing failed'}</ResultHeading>
      <p className="max-w-md text-sm text-ink-muted">{statusMessage}</p>
      <p className="max-w-md text-small text-ink-muted">Your file, caption and settings are kept. Try again goes back to them.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button onClick={progress.retry}>Try again</Button>
        <Button variant="outline" onClick={onReset}>Start over</Button>
      </div>
    </>
  );
}
