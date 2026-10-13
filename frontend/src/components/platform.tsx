import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { YouTubeIcon, InstagramIcon, RedditIcon } from '@/components/brand/platform-icons';
import { PLATFORM_META, platformOf, accountImage, accountInitials, accountName } from '@/lib/accounts';
import { cn } from '@/lib/utils';

const ICONS = { youtube: YouTubeIcon, instagram: InstagramIcon, reddit: RedditIcon };

export function PlatformIcon({ platform, className }) {
  const Icon = ICONS[platform] || YouTubeIcon;
  return <Icon className={cn('size-4 shrink-0', className)} />;
}

export function PlatformBadge({ platform, className }) {
  const key = PLATFORM_META[platform] ? platform : 'youtube';
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-pill border border-line px-2 text-caption font-medium text-ink-muted',
        className,
      )}
    >
      <PlatformIcon platform={key} className="size-3" />
      {PLATFORM_META[key].label}
    </span>
  );
}

// Avatar with a small platform glyph in the corner, so platform reads without colour alone
export function AccountAvatar({ account, size = 'default', showPlatform = false, className }) {
  const platform = platformOf(account);
  const sizes = { xs: 'size-5', sm: 'size-6', default: 'size-8', lg: 'size-11', xl: 'size-16' };
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <Avatar className={cn(sizes[size] || sizes.default)}>
        <AvatarImage src={accountImage(account)} alt={accountName(account)} />
        <AvatarFallback className="bg-surface-sunken text-caption font-semibold text-ink-muted">
          {accountInitials(account)}
        </AvatarFallback>
      </Avatar>
      {showPlatform && (
        <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-surface-raised text-ink-muted ring-2 ring-surface-raised">
          <PlatformIcon platform={platform} className="size-2.5" />
        </span>
      )}
    </span>
  );
}
