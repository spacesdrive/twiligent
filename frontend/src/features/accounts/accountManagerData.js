import { ADMIN_EMAIL } from '../../lib/contact.js';
import { accountHandle } from '../../lib/accounts.js';

export const TESTER_HINT = `If your account is not an Instagram tester yet, email ${ADMIN_EMAIL} to be added, then accept the invite in Instagram.`;

const IG_ERRORS = {
  already_added: 'This Instagram account is already connected.',
  cancelled: 'Instagram sign-in was cancelled. Try again when you are ready.',
  access_denied: `Instagram did not grant access. Approve every requested permission and try again. ${TESTER_HINT}`,
  invalid_state: 'The Instagram sign-in link expired. Start the connection again.',
};

const METRICS = {
  youtube:   acct => [['Subscribers', acct.subscriberCount], ['Views', acct.viewCount], ['Videos', acct.videoCount]],
  instagram: acct => [['Followers', acct.followersCount], ['Following', acct.followsCount], ['Posts', acct.mediaCount]],
  reddit:    acct => [['Karma', acct.totalKarma], ['Post karma', acct.postKarma], ['Comment karma', acct.commentKarma]],
};

const ACCOUNT_SECTIONS = [
  { key: 'youtube',   title: 'YouTube channels' },
  { key: 'instagram', title: 'Instagram accounts' },
  { key: 'reddit',    title: 'Reddit accounts' },
];

export function instagramErrorMessage(code) {
  return IG_ERRORS[code] || `Instagram connection failed: ${code}. ${TESTER_HINT}`;
}

// oauth returns ?ig_connected=true or ?ig_error=...; ?add=1 opens the add flow
export function readOAuthReturn(searchParams) {
  const connected = searchParams.get('ig_connected');
  const igError = searchParams.get('ig_error');
  const add = searchParams.get('add');
  if (!connected && !igError && !add) return null;

  return {
    connected: connected === 'true',
    errorMessage: igError ? instagramErrorMessage(igError) : null,
    openAdd: Boolean(add),
  };
}

export function accountMetrics(platform, account) {
  return METRICS[platform](account);
}

export function accountCardHandle(account, platform) {
  if (platform === 'reddit') return `u/${account.username || ''}`;
  return accountHandle(account);
}

export function visibleSections(groups) {
  return ACCOUNT_SECTIONS.filter(section => groups[section.key].length > 0);
}
