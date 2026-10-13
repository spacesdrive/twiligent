import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { YouTubeIcon, InstagramIcon, RedditIcon } from '@/components/brand/platform-icons';
import type { PlatformIconProps as SvgIconProps } from '@/components/brand/platform-icons';
import { PLATFORM_META, platformOf, accountImage, accountInitials, accountName } from '@/lib/accounts';
import { cn } from '@/lib/utils';
import type { AccountFields } from '@/lib/accounts';
import type { Platform } from '@shared/types/domain.ts';

const ICONS: Record<Platform, React.ComponentType<SvgIconProps>> = { youtube: YouTubeIcon, instagram: InstagramIcon, reddit: RedditIcon };

export type AccountAvatarSize = 'xs' | 'sm' | 'default' | 'lg' | 'xl';

// platform stays a string: tracked posts pass their free-form content type
export interface PlatformIconProps {
  platform: string;
  className?: string;
}

export function PlatformIcon({ platform, className }: PlatformIconProps) {
  const Icon = ICONS[platform as Platform] || YouTubeIcon;
  return <Icon className={cn('size-4 shrink-0', className)} />;
}

export type PlatformBadgeProps = PlatformIconProps;

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  const key = PLATFORM_META[platform as Platform] ? platform : 'youtube';
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-pill border border-line px-2 text-caption font-medium text-ink-muted',
        className,
      )}
    >
      <PlatformIcon platform={key} className="size-3" />
      {PLATFORM_META[key as Platform].label}
    </span>
  );
}

// Avatar with a small platform glyph in the corner, so platform reads without colour alone
export interface AccountAvatarProps {
  account: AccountFields;
  size?: AccountAvatarSize;
  showPlatform?: boolean;
  className?: string;
}

export function AccountAvatar({ account, size = 'default', showPlatform = false, className }: AccountAvatarProps) {
  const platform = platformOf(account);
  const sizes: Record<AccountAvatarSize, string> = { xs: 'size-5', sm: 'size-6', default: 'size-8', lg: 'size-11', xl: 'size-16' };
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
