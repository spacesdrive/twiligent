import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { useAppContext } from '../../../context/AppContext';
import { platformOf } from '@/lib/accounts';
import { engagementPercent, parseIsoDuration } from '@/lib/library';

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
      const allVideos = [];
      const channelList = [];
      results.forEach((result, i) => {
        if (result.status !== 'fulfilled') return;
        const acct = channelAccounts[i];
        const res = result.value;
        const channelTitle = acct.title || acct.channelTitle || 'Unknown channel';
        channelList.push({ id: acct.id, title: channelTitle, account: acct });
        for (const v of res.videos || res.data?.videos || []) {
          allVideos.push({
            ...v,
            thumbnail: v.thumbnail || v.thumbnails?.medium || v.thumbnails?.high || v.thumbnails?.default || '',
            channelTitle,
            channelId: acct.id,
            engagementRate: engagementPercent(v.viewCount, v.likeCount, v.commentCount),
            durationSeconds: v.durationSeconds || parseIsoDuration(v.duration),
          });
        }
      });
      setVideos(allVideos);
      setChannels(channelList);
    } catch (err) {
      showToast(`Couldn't load videos. ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [accounts, showToast]);

  useEffect(() => { load(); }, [load]);

  return { videos, channels, loading, reload: load };
}
