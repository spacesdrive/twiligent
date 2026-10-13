import type { ComponentType } from 'react';
import { YouTubeIcon, InstagramIcon, RedditIcon } from '@/components/brand/platform-icons';
import type { PlatformIconProps } from '@/components/brand/platform-icons';
import type { Platform } from '@shared/types/domain.ts';

export interface PlatformChoice {
  value: Platform;
  title: string;
  description: string;
  Icon: ComponentType<PlatformIconProps>;
}

export const PLATFORM_CHOICES: PlatformChoice[] = [
  { value: 'youtube',   title: 'YouTube channel',   description: 'Paste a channel link, @handle or channel ID.', Icon: YouTubeIcon },
  { value: 'instagram', title: 'Instagram account', description: 'Sign in with Instagram. Business or Creator accounts only.', Icon: InstagramIcon },
  { value: 'reddit',    title: 'Reddit account',    description: 'Add a username and a session cookie from your browser.', Icon: RedditIcon },
];

export function platformChoiceTitle(value: Platform): string {
  return (PLATFORM_CHOICES.find(choice => choice.value === value) as PlatformChoice).title;
}
