import { useEffect, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import SurfaceBox from '@/components/SurfaceBox';
import { FieldRow } from '@/components/DetailPanel';
import { fieldErrorId } from '@/lib/fieldIds';
import { cn } from '@/lib/utils';
import TypePicker from './TypePicker';
import { fileSizeMb, isVideoFile } from './queueHelpers.ts';
import type { ContentTypeOption } from './publishConstants';
import type { SinglePostForm } from './useSinglePostForm';

interface MediaPreviewProps {
  file: File;
  filePreview: string;
  selectedType: ContentTypeOption | undefined;
  onClear: () => void;
}

interface MediaPickerProps {
  form: SinglePostForm;
  selectedType: ContentTypeOption | undefined;
  typeError?: string;
  fileError?: string;
}

function MediaPreview({ file, filePreview, selectedType, onClear }: MediaPreviewProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="relative w-full shrink-0 overflow-hidden rounded-control bg-surface-sunken sm:w-52">
        {isVideoFile(file) ? (
          <video src={filePreview} controls muted className="max-h-72 w-full bg-media-scrim object-contain" />
        ) : (
          <img src={filePreview} alt="Preview of the chosen photo" className="max-h-72 w-full object-contain" />
        )}
        <button
          type="button"
          onClick={onClear}
          aria-label={`Remove ${file.name}`}
          className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-media-scrim/75 text-on-media transition-colors hover:bg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink" title={file.name}>{file.name}</p>
        <p className="text-small text-ink-muted">{fileSizeMb(file, 2)} MB, {file.type}</p>
        <Badge variant="default" className="mt-2">{selectedType?.label}</Badge>
      </div>
    </div>
  );
}

export default function MediaPicker({ form, selectedType, typeError, fileError }: MediaPickerProps) {
  const { contentType, file, fileInputRef } = form;
  const hadFile = useRef(Boolean(file));

  // removing the file removes the focused button, so focus moves to the button that picks a new one
  useEffect(() => {
    if (hadFile.current && !file) document.getElementById('post-file')?.focus();
    hadFile.current = Boolean(file);
  }, [file]);

  return (
    <SurfaceBox title="Media" subheader={selectedType ? selectedType.desc : 'Choose what you are posting, then add the file.'}>
      <div className="flex flex-col gap-4">
        <FieldRow label="What you are posting" htmlFor="post-type-group" group error={typeError}>
          <TypePicker
            id="post-type"
            name="post-type"
            value={contentType}
            onChange={form.changeContentType}
            aria-describedby={typeError ? fieldErrorId('post-type-group') : undefined}
          />
        </FieldRow>
        {file ? (
          <MediaPreview file={file} filePreview={form.filePreview as string} selectedType={selectedType} onClear={form.clearFile} />
        ) : (
          <div className="flex flex-col gap-2">
            <button
              id="post-file"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!contentType}
              aria-describedby={[fileError ? fieldErrorId('post-file') : '', 'post-file-help'].filter(Boolean).join(' ')}
              aria-invalid={fileError ? true : undefined}
              className={cn(
                'flex w-full flex-col items-center gap-2 rounded-card border border-dashed p-10 text-center transition-colors duration-(--duration-fast)',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                contentType ? 'border-line-strong/50 hover:border-brand hover:bg-brand-soft/30' : 'cursor-not-allowed border-line opacity-60',
                fileError && 'border-danger',
              )}
            >
              <Upload className="size-8 stroke-[1.5] text-ink-faint" aria-hidden="true" />
              <span className="text-sm font-medium text-ink">{contentType ? 'Choose a file' : 'Choose what you are posting first'}</span>
              <span id="post-file-help" className="text-small text-ink-muted">{selectedType ? selectedType.desc : 'Photo, Reel or Story, above.'}</span>
            </button>
            {fileError && <p id={fieldErrorId('post-file')} className="text-sm text-danger"><span className="sr-only">Error: </span>{fileError}</p>}
          </div>
        )}
        <input ref={fileInputRef} type="file" hidden accept={selectedType?.accept || '*'} onChange={form.handleFileSelect} aria-label="Media file" />
      </div>
    </SurfaceBox>
  );
}
