import { YouTubeIcon, InstagramIcon, RedditIcon } from '@/components/brand/platform-icons';

export const PLATFORM_CHOICES = [
  { value: 'youtube',   title: 'YouTube channel',   description: 'Paste a channel link, @handle or channel ID.', Icon: YouTubeIcon },
  { value: 'instagram', title: 'Instagram account', description: 'Sign in with Instagram. Business or Creator accounts only.', Icon: InstagramIcon },
  { value: 'reddit',    title: 'Reddit account',    description: 'Add a username and a session cookie from your browser.', Icon: RedditIcon },
];

export function platformChoiceTitle(value) {
  return PLATFORM_CHOICES.find(choice => choice.value === value).title;
}
