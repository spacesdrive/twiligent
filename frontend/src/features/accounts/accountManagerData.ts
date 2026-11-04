import { ADMIN_EMAIL } from '../../lib/contact.ts';
import { accountHandle } from '../../lib/accounts.ts';
import type { AccountFields } from '../../lib/accounts.ts';
import type { Platform } from '../../../../shared/types/domain.ts';

export const TESTER_HINT = `If your account is not an Instagram tester yet, email ${ADMIN_EMAIL} to be added, then accept the invite in Instagram.`;

// the counts each platform card shows
export interface AccountMetricFields {
  subscriberCount?: number;
  viewCount?: number;
  videoCount?: number;
  followersCount?: number;
  followsCount?: number;
  mediaCount?: number;
  totalKarma?: number;
  postKarma?: number;
  commentKarma?: number;
}

export type AccountMetric = [label: string, value: number | undefined];

export interface AccountSectionInfo {
  key: Platform;
  title: string;
}

export interface OAuthReturn {
  connected: boolean;
  // the account was already connected, and connecting it again renewed its token
  reconnected: boolean;
  errorMessage: string | null;
  openAdd: boolean;
}

const IG_ERRORS: Record<string, string> = {
  already_added: 'This Instagram account is already connected.',
  cancelled: 'Instagram sign-in was cancelled. Try again when you are ready.',
  access_denied: `Instagram did not grant access. Approve every requested permission and try again. ${TESTER_HINT}`,
  invalid_state: 'The Instagram sign-in link expired. Start the connection again.',
  not_configured: 'Instagram connections are not set up on this server. Ask your administrator to add the Instagram app ID and secret.',
};

const METRICS: Record<Platform, (acct: AccountMetricFields) => AccountMetric[]> = {
  youtube:   acct => [['Subscribers', acct.subscriberCount], ['Views', acct.viewCount], ['Videos', acct.videoCount]],
  instagram: acct => [['Followers', acct.followersCount], ['Following', acct.followsCount], ['Posts', acct.mediaCount]],
  reddit:    acct => [['Karma', acct.totalKarma], ['Post karma', acct.postKarma], ['Comment karma', acct.commentKarma]],
};

const ACCOUNT_SECTIONS: AccountSectionInfo[] = [
  { key: 'youtube',   title: 'YouTube channels' },
  { key: 'instagram', title: 'Instagram accounts' },
  { key: 'reddit',    title: 'Reddit accounts' },
];

export function instagramErrorMessage(code: string): string {
  return IG_ERRORS[code] || `Instagram connection failed: ${code}. ${TESTER_HINT}`;
}

// oauth returns ?ig_connected=true, ?ig_connected=reconnected or ?ig_error=...; ?add=1 opens the add flow
export function readOAuthReturn(searchParams: URLSearchParams): OAuthReturn | null {
  const connected = searchParams.get('ig_connected');
  const igError = searchParams.get('ig_error');
  const add = searchParams.get('add');
  if (!connected && !igError && !add) return null;

  return {
    connected: connected === 'true' || connected === 'reconnected',
    reconnected: connected === 'reconnected',
    errorMessage: igError ? instagramErrorMessage(igError) : null,
    openAdd: Boolean(add),
  };
}

export function accountMetrics(platform: Platform, account: AccountMetricFields): AccountMetric[] {
  return METRICS[platform](account);
}

export function accountCardHandle(account: AccountFields, platform: Platform): string {
  if (platform === 'reddit') return `u/${account.username || ''}`;
  return accountHandle(account);
}

export function visibleSections(groups: Record<Platform, unknown[]>): AccountSectionInfo[] {
  return ACCOUNT_SECTIONS.filter(section => groups[section.key].length > 0);
}

// people paste "u/name", "@name" or their profile address; the Worker keeps the same name
export function redditUsername(input: string): string {
  const text = input.trim();
  const fromUrl = text.match(/reddit\.com\/(?:user|u)\/([^/?#\s]+)/i);
  return (fromUrl ? fromUrl[1] : text).replace(/^\/?u\//i, '').replace(/^@/, '').trim();
}

export type AddAccountField = 'channel' | 'username' | 'cookie';

export interface AddAccountProblem {
  field: AddAccountField;
  message: string;
}

// what is missing before an account can be added, or null
export function redditFieldsProblem(username: string, cookie: string): AddAccountProblem | null {
  if (!redditUsername(username)) return { field: 'username', message: 'Enter the Reddit username, such as u/name.' };
  if (!cookie.trim()) return { field: 'cookie', message: 'Paste the reddit_session cookie value. The steps below show where to find it.' };
  return null;
}

export function channelFieldProblem(input: string): AddAccountProblem | null {
  return input.trim() ? null : { field: 'channel', message: 'Paste a channel link, an @handle or a channel ID that starts with UC.' };
}
