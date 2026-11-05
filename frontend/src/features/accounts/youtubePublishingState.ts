import type { YouTubeConnectionSummary } from '../../../../shared/types/youtubePublishing.ts';

export interface PublishingAccount {
  id: string;
  platform: string;
  channelId?: string;
}

export interface PublishingStatus {
  loading: boolean;
  failed: boolean;
  configured: boolean;
  connections: YouTubeConnectionSummary[];
}

// hidden: not a YouTube card, or the section already says why publishing is unavailable
export type CardPublishing =
  | { kind: 'hidden' }
  | { kind: 'loading' }
  | { kind: 'unverified' }
  | { kind: 'verified'; connection: YouTubeConnectionSummary }
  | { kind: 'needs_sign_in'; connection: YouTubeConnectionSummary };

export function connectionFor(account: PublishingAccount, connections: YouTubeConnectionSummary[]): YouTubeConnectionSummary | null {
  return connections.find(connection => connection.accountId === account.id || (account.channelId !== undefined && connection.channelId === account.channelId)) ?? null;
}

export function cardPublishing(account: PublishingAccount, status: PublishingStatus): CardPublishing {
  if (account.platform !== 'youtube' || !account.channelId) return { kind: 'hidden' };
  if (status.loading) return { kind: 'loading' };
  if (status.failed || !status.configured) return { kind: 'hidden' };
  const connection = connectionFor(account, status.connections);
  if (!connection) return { kind: 'unverified' };
  return connection.status === 'active' ? { kind: 'verified', connection } : { kind: 'needs_sign_in', connection };
}

// a failed return from Google, as a toast that says what failed and what to do
const RETURN_ERRORS: Record<string, string> = {
  access_denied: 'Couldn\'t verify the channel. The Google sign-in was cancelled.',
  cancelled: 'Couldn\'t verify the channel. The Google sign-in was cancelled.',
  invalid_state: 'Couldn\'t verify the channel. The sign-in link expired or was changed. Choose Verify again.',
};

export function verifyReturnError(search: URLSearchParams): string | null {
  const error = search.get('yt_error');
  if (!error) return null;
  return RETURN_ERRORS[error] ?? `Couldn't verify the channel. Google answered "${error}". Choose Verify again.`;
}
