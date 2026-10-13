import type { Platform } from '../../../shared/types/domain.ts';

export interface PlatformMeta {
  label: string;
  audienceLabel: string;
  series: string;
}

// the account fields these helpers read; raw api accounts and normalized app accounts both fit
export interface AccountFields {
  id?: string;
  platform?: string;
  title?: string | null;
  username?: string;
  channelId?: string;
  customUrl?: string;
  thumbnail?: string;
  profilePictureUrl?: string;
  thumbnails?: { default?: string };
  iconUrl?: string;
  followersCount?: number;
  totalKarma?: number;
  subscriberCount?: number;
}

export const PLATFORMS: Platform[] = ['youtube', 'instagram', 'reddit'];

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  youtube:   { label: 'YouTube',   audienceLabel: 'subscribers', series: 'var(--chart-1)' },
  instagram: { label: 'Instagram', audienceLabel: 'followers',   series: 'var(--chart-3)' },
  reddit:    { label: 'Reddit',    audienceLabel: 'karma',       series: 'var(--chart-4)' },
};

// Accounts saved before multi-platform support have no platform field and are YouTube channels
export function platformOf(account: AccountFields | null | undefined): Platform {
  const platform = account?.platform;
  return platform === 'instagram' || platform === 'reddit' ? platform : 'youtube';
}

export function accountPath(account: AccountFields): string {
  const platform = platformOf(account);
  if (platform === 'instagram') return `/instagram/${account.id}`;
  if (platform === 'reddit') return `/reddit/${account.id}`;
  return `/channel/${account.id}`;
}

export function accountName(account: AccountFields | null | undefined): string {
  if (!account) return '';
  if (platformOf(account) === 'reddit') return `u/${account.username || ''}`;
  return account.title || account.username || account.channelId || '';
}

export function accountHandle(account: AccountFields | null | undefined): string {
  if (!account) return '';
  const platform = platformOf(account);
  if (platform === 'instagram') return account.username ? `@${account.username}` : '';
  if (platform === 'reddit') return 'Reddit';
  return account.customUrl || account.channelId || '';
}

export function accountImage(account: AccountFields | null | undefined): string {
  if (!account) return '';
  return account.thumbnail || account.profilePictureUrl || account.thumbnails?.default || account.iconUrl || '';
}

export function accountInitials(account: AccountFields | null | undefined): string {
  const source = account?.title || account?.username || '?';
  return source.replace(/^u\//, '').slice(0, 2).toUpperCase();
}

export function audienceOf(account: AccountFields): number {
  const platform = platformOf(account);
  if (platform === 'instagram') return account.followersCount || 0;
  if (platform === 'reddit') return account.totalKarma || 0;
  return account.subscriberCount || 0;
}

export function groupByPlatform<T extends AccountFields>(accounts: T[] | null | undefined): Record<Platform, T[]> {
  const groups: Record<Platform, T[]> = { youtube: [], instagram: [], reddit: [] };
  for (const account of accounts || []) groups[platformOf(account)].push(account);
  return groups;
}

// "2 YouTube, 1 Instagram" style summary, empty platforms omitted
export function platformSummary(accounts: AccountFields[] | null | undefined): string {
  const groups = groupByPlatform(accounts);
  return PLATFORMS
    .filter(p => groups[p].length > 0)
    .map(p => `${groups[p].length} ${PLATFORM_META[p].label}`)
    .join(', ');
}
