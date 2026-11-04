import { useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { accountName } from '@/lib/accounts';
import type { AppAccount } from '../../../utils/formatters';
import { useLibrarySources } from '../useLibrarySources';
import { mergeAccountMedia } from './reelsLibrary.ts';

function nameOf(account: AppAccount): string {
  return accountName(account) || 'Unknown account';
}

// one failed Instagram account does not hide media from the rest, and the page names it
export function useInstagramMedia() {
  const { accounts } = useAppContext();
  const igAccounts = useMemo(() => accounts.filter(account => account.platform === 'instagram'), [accounts]);
  const library = useLibrarySources(igAccounts, api.getIGMedia, nameOf, 'Instagram content');
  const media = useMemo(() => mergeAccountMedia(library.sources, library.results), [library.sources, library.results]);
  return {
    igAccounts,
    media,
    failures: library.failures,
    fetchedAt: library.fetchedAt,
    loading: library.initialLoading,
    refreshing: library.refreshing,
    refresh: library.refresh,
  };
}
