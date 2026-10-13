import { Upload } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import SurfaceBox from '@/components/SurfaceBox';
import PublishResult from './PublishResult';
import { progressHeading } from './queueHelpers.ts';
import type { PublishStatus } from './queueHelpers.ts';
import type { PublishResultProps } from './PublishResult';

const WORKING_STATUSES: PublishStatus[] = ['creating-container', 'publishing', 'scheduling', 'processing'];

export default function PublishProgress({ progress, ...resultProps }: PublishResultProps) {
  const { publishStatus, statusMessage, uploadProgress } = progress;
  return (
    <SurfaceBox>
      <div role="status" className="flex flex-col items-center gap-3 py-10 text-center">
        {publishStatus === 'uploading-cloudinary' && (
          <>
            <Upload className="size-10 stroke-[1.5] text-ink-muted" />
            <h2 className="font-heading text-section font-semibold text-ink">Uploading media</h2>
            <Progress value={uploadProgress} className="w-72 max-w-full" aria-label="Upload progress" />
            <p className="text-small text-ink-muted tabular-nums">{uploadProgress}% uploaded</p>
          </>
        )}
        {WORKING_STATUSES.includes(publishStatus) && (
          <>
            <Spinner className="size-10 text-brand" />
            <h2 className="font-heading text-section font-semibold text-ink">{progressHeading(publishStatus)}</h2>
            <p className="text-small text-ink-muted">{statusMessage}</p>
            {publishStatus === 'processing' && <p className="text-caption text-ink-faint">Videos can take a minute.</p>}
          </>
        )}
        <PublishResult progress={progress} {...resultProps} />
      </div>
    </SurfaceBox>
  );
}
