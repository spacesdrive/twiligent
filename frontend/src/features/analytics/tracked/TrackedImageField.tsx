import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { FieldRow } from '@/components/DetailPanel';
import ImageLightbox from '@/components/ImageLightbox';
import type { TrackedEditor } from './useTrackedEditor';

interface UploadImageButtonProps {
  uploading: boolean;
  disabled: boolean;
  onClick: () => void;
}

function UploadImageButton({ uploading, disabled, onClick }: UploadImageButtonProps) {
  if (uploading) {
    return (
      <Button type="button" variant="outline" className="justify-start" onClick={onClick} disabled>
        <Spinner className="size-4" />
        Uploading image
      </Button>
    );
  }
  return (
    <Button type="button" variant="outline" className="justify-start" onClick={onClick} disabled={disabled}>
      <Upload data-icon="inline-start" />
      Upload image
    </Button>
  );
}

export interface TrackedImageFieldProps {
  editor: TrackedEditor;
}

export default function TrackedImageField({ editor }: TrackedImageFieldProps) {
  const { imageUrl, uploading, imageInputRef, cloudConfig, editItem } = editor;
  const hint = cloudConfig
    ? 'Reddit posts have no thumbnail in the public API. Upload a screenshot to recognise the post at a glance.'
    : 'Image uploads need Cloudinary set up on the server. Check Settings.';
  return (
    <FieldRow label="Image" hint={hint}>
      <input ref={imageInputRef} type="file" accept="image/*" onChange={editor.handleImageSelect} className="hidden" aria-label="Choose an image" />
      {imageUrl ? (
        <div className="flex items-center gap-3 rounded-control border border-line p-2">
          <ImageLightbox src={imageUrl} alt={editItem!.title || 'Reddit post'} thumbClassName="size-14" />
          <p className="min-w-0 flex-1 text-caption text-ink-faint">Select the image to view it full size.</p>
          <Button variant="ghost" size="icon-xs" onClick={() => editor.setImageUrl(null)} disabled={uploading} aria-label="Remove image">
            <X />
          </Button>
        </div>
      ) : (
        <UploadImageButton uploading={uploading} disabled={!cloudConfig} onClick={() => imageInputRef.current?.click()} />
      )}
    </FieldRow>
  );
}
