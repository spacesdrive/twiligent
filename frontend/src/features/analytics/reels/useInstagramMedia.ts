import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { mergeAccountMedia } from './reelsLibrary.ts';

// one failed Instagram account does not hide media from the rest
export function useInstagramMedia() {
  const { accounts, showToast } = useAppContext();
  const igAccounts = useMemo(() => accounts.filter(account => account.platform === 'instagram'), [accounts]);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAllMedia = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled(igAccounts.map(account => api.getIGMedia(account.id)));
      setMedia(mergeAccountMedia(igAccounts, results));
    } catch (err) {
      showToast(`Couldn't load Instagram content. ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [igAccounts, showToast]);

  useEffect(() => { loadAllMedia(); }, [loadAllMedia]);

  return { igAccounts, media, loading, loadAllMedia };
}
