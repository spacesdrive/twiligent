import { useEffect, useState } from 'react';
import { Square, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import SurfaceBox from '@/components/SurfaceBox';
import PublishResult from './PublishResult';
import { EXPECTED_PROCESSING_SECONDS, MAX_PROCESSING_SECONDS } from './containerPolling.ts';
import { progressHeading } from './queueHelpers.ts';
import type { PublishStatus } from './queueHelpers.ts';
import type { PublishResultProps } from './PublishResult';

const WORKING_STATUSES: PublishStatus[] = ['creating-container', 'publishing', 'scheduling', 'processing'];

interface PublishProgressProps extends PublishResultProps {
  onStopWaiting: () => void;
}

// seconds since Instagram started processing, so a long wait shows it is still moving and how long is normal
function useElapsedSeconds(running: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const startedAt = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => {
      clearInterval(timer);
      setSeconds(0);
    };
  }, [running]);
  return seconds;
}

// the visible progress; the page announces each stage through its own live region, so this block is not one
export default function PublishProgress({ progress, onStopWaiting, ...resultProps }: PublishProgressProps) {
  const { publishStatus, statusMessage, uploadProgress } = progress;
  const processing = publishStatus === 'processing';
  const elapsed = useElapsedSeconds(processing);
  return (
    <SurfaceBox>
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        {publishStatus === 'uploading-cloudinary' && (
          <>
            <Upload className="size-10 stroke-[1.5] text-ink-muted" aria-hidden="true" />
            <h2 className="font-heading text-section font-semibold text-ink">Uploading media</h2>
            <Progress value={uploadProgress} className="w-72 max-w-full" aria-label="Upload progress" />
            <p className="text-small text-ink-muted tabular-nums" aria-hidden="true">{uploadProgress}% uploaded</p>
          </>
        )}
        {WORKING_STATUSES.includes(publishStatus) && (
          <>
            <Spinner className="size-10 text-brand" />
            <h2 className="font-heading text-section font-semibold text-ink">{progressHeading(publishStatus)}</h2>
            <p className="max-w-prose text-small text-ink-muted">{statusMessage}</p>
            {processing && (
              <>
                <p className="text-small text-ink-muted tabular-nums">
                  Waiting {elapsed} seconds. Usually under {EXPECTED_PROCESSING_SECONDS} seconds; Twiligent waits up to {MAX_PROCESSING_SECONDS}.
                </p>
                <Button variant="outline" size="sm" onClick={onStopWaiting}>
                  <Square data-icon="inline-start" />Stop waiting
                </Button>
              </>
            )}
          </>
        )}
        <PublishResult progress={progress} {...resultProps} />
      </div>
    </SurfaceBox>
  );
}
