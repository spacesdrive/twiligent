import { FolderUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SurfaceBox from '@/components/SurfaceBox';
import BulkFileItem from './BulkFileItem';
import { bulkFilesTitle } from './queueHelpers.ts';
import type { ContentTypeOption } from './publishConstants';
import type { BulkQueue } from './useBulkQueue';

interface BulkFileListProps {
  queue: BulkQueue;
  bulkType: ContentTypeOption | undefined;
}

export default function BulkFileList({ queue, bulkType }: BulkFileListProps) {
  const { files, processing, fileInputRef } = queue;
  const openPicker = () => fileInputRef.current?.click();
  const actions = (
    <div className="flex gap-2">
      {files.length > 0 && !processing && (
        <Button size="sm" variant="ghost" onClick={queue.clearFiles} className="hover:bg-danger-soft hover:text-danger">
          <Trash2 data-icon="inline-start" />Clear all
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={openPicker} disabled={processing}>
        <Plus data-icon="inline-start" />Add files
      </Button>
    </div>
  );
  return (
    <SurfaceBox title={bulkFilesTitle(files.length)} subheader={bulkType?.desc} secondary={actions}>
      <input ref={fileInputRef} type="file" hidden multiple accept={bulkType?.accept || '*'} onChange={queue.handleFilesSelect} aria-label="Files to upload" />
      {files.length === 0 ? (
        <button
          type="button"
          onClick={openPicker}
          className="flex w-full flex-col items-center gap-2 rounded-card border border-dashed border-line-strong/50 p-10 text-center transition-colors duration-(--duration-fast) hover:border-brand hover:bg-brand-soft/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <FolderUp className="size-8 stroke-[1.5] text-ink-faint" />
          <span className="text-sm font-medium text-ink">Choose several files</span>
          <span className="text-caption text-ink-faint">Each file becomes its own post, published or scheduled in order.</span>
        </button>
      ) : (
        <ul className="flex max-h-[34rem] flex-col gap-2 overflow-y-auto pr-1">
          {files.map((item, index) => (
            <BulkFileItem
              key={item.id}
              item={item}
              position={index + 1}
              processing={processing}
              onCaptionChange={(id, caption) => queue.patchFile(id, { caption })}
              onRemove={queue.removeFile}
            />
          ))}
        </ul>
      )}
    </SurfaceBox>
  );
}
