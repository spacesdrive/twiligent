import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { LockKeyhole } from '@/components/icons';
import { InstagramIcon, RedditIcon, YouTubeIcon } from '@/components/marks';
import type { Platform } from './platforms';

export interface WindowProps {
  // the address shown in the bar; omitted for an app window without browser chrome
  url?: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

// a browser window in brand colours: three dots, an address pill, then the page
export function Window({ url, className, bodyClassName, children }: WindowProps) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-line bg-surface-raised shadow-window', className)}>
      <div className="flex h-10 items-center gap-3 border-b border-line bg-surface-sunken/60 px-3.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-line-strong/50" />
          <span className="size-2.5 rounded-full bg-line-strong/50" />
          <span className="size-2.5 rounded-full bg-line-strong/50" />
        </span>
        {url && (
          <span className="mx-auto flex h-6 min-w-0 max-w-[60%] items-center gap-1.5 rounded-full bg-surface-raised px-3 font-mono text-[11px] text-ink-muted ring-1 ring-line">
            <LockKeyhole className="size-3 shrink-0" />
            <span className="truncate">{url}</span>
          </span>
        )}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

// the card a feature panel holds, 544 by 448 at desktop size like the Activepieces panels
export function PanelCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'relative w-full max-w-[34rem] overflow-hidden rounded-lg border border-line bg-surface-raised shadow-window',
        className,
      )}
    >
      {children}
    </div>
  );
}

// a grey line standing in for text the picture does not need to spell out
export function Bar({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('block h-2 rounded-full bg-line', className)} />;
}

const PLATFORM_STYLE: Record<Platform, { icon: typeof YouTubeIcon; tint: string }> = {
  youtube: { icon: YouTubeIcon, tint: 'text-youtube' },
  instagram: { icon: InstagramIcon, tint: 'text-instagram' },
  reddit: { icon: RedditIcon, tint: 'text-reddit' },
};

// a platform's own mark in its own colour, the one place colours outside the palette appear, as each platform asks
export function PlatformMark({ platform, className }: { platform: Platform; className?: string }) {
  const style = PLATFORM_STYLE[platform];
  const Icon = style.icon;
  return <Icon className={cn(style.tint, className)} />;
}
