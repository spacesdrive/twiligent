import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { useAppContext } from '../../../context/AppContext';
import { platformOf } from '@/lib/accounts';
import { mergeChannelVideos } from './videoLibrary';

// Loads every video from every YouTube channel. Shared by the Videos and Shorts pages.
export function useChannelVideos() {
  const { accounts, showToast } = useAppContext();
  const [videos, setVideos] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const channelAccounts = (accounts || []).filter(a => platformOf(a) === 'youtube');
      const results = await Promise.allSettled(channelAccounts.map(a => api.getVideos(a.id)));
      const merged = mergeChannelVideos(channelAccounts, results);
      setVideos(merged.videos);
      setChannels(merged.channels);
    } catch (err) {
      showToast(`Couldn't load videos. ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [accounts, showToast]);

  useEffect(() => { load(); }, [load]);

  return { videos, channels, loading, reload: load };
}
