// platform helpers for every page; no jsx or path aliases so node --test can import it

export const PLATFORMS = ['youtube', 'instagram', 'reddit'];

export const PLATFORM_META = {
  youtube:   { label: 'YouTube',   audienceLabel: 'subscribers', series: 'var(--chart-1)' },
  instagram: { label: 'Instagram', audienceLabel: 'followers',   series: 'var(--chart-3)' },
  reddit:    { label: 'Reddit',    audienceLabel: 'karma',       series: 'var(--chart-4)' },
};

// Accounts saved before multi-platform support have no platform field and are YouTube channels
export function platformOf(account) {
  const platform = account?.platform;
  return platform === 'instagram' || platform === 'reddit' ? platform : 'youtube';
}

export function accountPath(account) {
  const platform = platformOf(account);
  if (platform === 'instagram') return `/instagram/${account.id}`;
  if (platform === 'reddit') return `/reddit/${account.id}`;
  return `/channel/${account.id}`;
}

export function accountName(account) {
  if (!account) return '';
  if (platformOf(account) === 'reddit') return `u/${account.username || ''}`;
  return account.title || account.username || account.channelId || '';
}

export function accountHandle(account) {
  if (!account) return '';
  const platform = platformOf(account);
  if (platform === 'instagram') return account.username ? `@${account.username}` : '';
  if (platform === 'reddit') return 'Reddit';
  return account.customUrl || account.channelId || '';
}

export function accountImage(account) {
  if (!account) return '';
  return account.thumbnail || account.profilePictureUrl || account.thumbnails?.default || account.iconUrl || '';
}

export function accountInitials(account) {
  const source = account?.title || account?.username || '?';
  return source.replace(/^u\//, '').slice(0, 2).toUpperCase();
}

export function audienceOf(account) {
  const platform = platformOf(account);
  if (platform === 'instagram') return account.followersCount || 0;
  if (platform === 'reddit') return account.totalKarma || 0;
  return account.subscriberCount || 0;
}

export function groupByPlatform(accounts) {
  const groups = { youtube: [], instagram: [], reddit: [] };
  for (const account of accounts || []) groups[platformOf(account)].push(account);
  return groups;
}

// "2 YouTube, 1 Instagram" style summary, empty platforms omitted
export function platformSummary(accounts) {
  const groups = groupByPlatform(accounts);
  return PLATFORMS
    .filter(p => groups[p].length > 0)
    .map(p => `${groups[p].length} ${PLATFORM_META[p].label}`)
    .join(', ');
}
