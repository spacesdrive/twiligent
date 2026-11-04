import { useEffect, useRef } from 'react';
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
    <Button id="tracked-image-upload" type="button" variant="outline" className="justify-start" onClick={onClick} disabled={disabled}>
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
  const hadImage = useRef(Boolean(imageUrl));

  // removing the image removes the focused button, so focus moves to the button that adds one
  useEffect(() => {
    if (hadImage.current && !imageUrl) document.getElementById('tracked-image-upload')?.focus();
    hadImage.current = Boolean(imageUrl);
  }, [imageUrl]);
  const hint = cloudConfig
    ? 'Reddit posts have no thumbnail in the public API. Upload a screenshot to recognise the post at a glance.'
    : 'Image uploads need Cloudinary set up on the server. Check Settings.';
  return (
    <FieldRow label="Image" optional hint={hint} error={editor.imageError ?? undefined}>
      <input ref={imageInputRef} type="file" accept="image/*" onChange={editor.handleImageSelect} className="hidden" aria-label="Choose an image" />
      {imageUrl ? (
        <div className="flex items-center gap-3 rounded-control border border-line p-2">
          <ImageLightbox src={imageUrl} alt={editItem!.title || 'Reddit post'} thumbClassName="size-14" />
          <p className="min-w-0 flex-1 text-small text-ink-muted">Select the image to view it full size.</p>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor.setImageUrl(null)} disabled={uploading} aria-label="Remove image">
            <X />
          </Button>
        </div>
      ) : (
        <UploadImageButton uploading={uploading} disabled={!cloudConfig} onClick={() => imageInputRef.current?.click()} />
      )}
    </FieldRow>
  );
}
