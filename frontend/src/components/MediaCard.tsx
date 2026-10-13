import React from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MediaAspect = 'video' | 'vertical' | 'square';

const ASPECTS: Record<MediaAspect, string> = { video: 'aspect-video', vertical: 'aspect-[9/16]', square: 'aspect-square' };

// Thumbnail card for library grids. Overlay chips sit on a dark scrim so they read on any image.
export interface MediaChipProps {
  children?: React.ReactNode;
  className?: string;
}

export function MediaChip({ children, className }: MediaChipProps) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-pill bg-media-scrim/75 px-2 py-0.5 text-[0.6875rem] font-semibold text-on-media backdrop-blur-sm [&_svg]:size-3', className)}>
      {children}
    </span>
  );
}

export interface MediaCardProps {
  image?: string | null;
  aspect?: MediaAspect;
  title?: React.ReactNode;
  meta?: React.ReactNode;
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  bottomRight?: React.ReactNode;
  href?: string;
  className?: string;
}

export default function MediaCard({
  image,
  aspect = 'video',
  title,
  meta,
  topLeft,
  topRight,
  bottomRight,
  href,
  className,
}: MediaCardProps) {
  const Element = href ? 'a' : 'div';
  return (
    <Element
      href={href}
      target={href ? '_blank' : undefined}
      rel={href ? 'noopener noreferrer' : undefined}
      className={cn(
        'group flex flex-col overflow-hidden rounded-card border border-line bg-surface-raised transition-colors duration-(--duration-fast)',
        href && 'hover:border-line-strong/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
    >
      <div className={cn('relative overflow-hidden bg-surface-sunken', ASPECTS[aspect])}>
        {image ? (
          <img src={image} alt="" loading="lazy" className="size-full object-cover transition-transform duration-(--duration-slow) ease-(--ease-fold) group-hover:scale-[1.02]" />
        ) : (
          <div className="flex size-full items-center justify-center text-ink-faint">
            <ImageOff className="size-6 stroke-[1.5]" />
          </div>
        )}
        {topLeft && <div className="absolute top-2 left-2">{topLeft}</div>}
        {topRight && <div className="absolute top-2 right-2">{topRight}</div>}
        {bottomRight && <div className="absolute right-2 bottom-2">{bottomRight}</div>}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {title && <p className="line-clamp-2 text-small font-medium leading-snug text-ink">{title}</p>}
        {meta && <div className="mt-auto flex items-center gap-3 text-caption text-ink-faint tabular-nums [&_svg]:size-3 [&_svg]:stroke-[1.75]">{meta}</div>}
      </div>
    </Element>
  );
}
