import { useMemo } from 'react';
import { api } from '../../../services/api';
import { useAppContext } from '../../../context/AppContext';
import { platformOf } from '@/lib/accounts';
import type { AppAccount } from '../../../utils/formatters';
import { useLibrarySources } from '../useLibrarySources';
import { mergeChannelVideos } from './videoLibrary';

function channelName(account: AppAccount): string {
  return account.title || 'Unknown channel';
}

// Loads every video from every YouTube channel. Shared by the Videos and Shorts pages.
export function useChannelVideos() {
  const { accounts } = useAppContext();
  const channelAccounts = useMemo(() => (accounts || []).filter(account => platformOf(account) === 'youtube'), [accounts]);
  const library = useLibrarySources(channelAccounts, api.getVideos, channelName, 'Videos');
  const merged = useMemo(() => mergeChannelVideos(library.sources, library.results), [library.sources, library.results]);
  return {
    videos: merged.videos,
    channels: merged.channels,
    // "no channels yet" comes from the account list, not from which requests happened to succeed
    channelCount: channelAccounts.length,
    failures: library.failures,
    fetchedAt: library.fetchedAt,
    loading: library.initialLoading,
    refreshing: library.refreshing,
    refresh: library.refresh,
  };
}
