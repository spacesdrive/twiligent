import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export default function ImageLightbox({
  src,
  alt = '',
  className = '',
  thumbClassName = 'h-10 w-16',
}) {
  const [open, setOpen] = useState(false);

  if (!src) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            title="View image"
            aria-label={alt ? `View image for ${alt}` : 'View image'}
            className={cn(
              'group relative shrink-0 overflow-hidden rounded border border-border bg-muted',
              'cursor-zoom-in transition-opacity hover:opacity-80',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              thumbClassName,
              className
            )}
          />
        }
      >
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      </DialogTrigger>

      <DialogContent className="sm:max-w-3xl p-2 gap-2">
        <DialogTitle className="sr-only">{alt || 'Image preview'}</DialogTitle>
        <img
          src={src}
          alt={alt}
          className="max-h-[75vh] w-full rounded-lg object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
