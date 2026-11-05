import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { anyActive } from './youtubeUploadData';
import type { AppContextValue } from '../../context/AppContext';
import type { YouTubeConnectionSummary, YouTubeUploadRequest, YouTubeUploadSummary } from '@shared/types/youtubePublishing.ts';

type ShowToast = AppContextValue['showToast'];

// uploads move on the server's 15 minute runs, so checking every half minute is plenty and costs one request
const ACTIVE_REFRESH_MS = 30 * 1000;

export function useYouTubePublishing(showToast: ShowToast) {
  const [connections, setConnections] = useState<YouTubeConnectionSummary[]>([]);
  const [configured, setConfigured] = useState(true);
  const [uploads, setUploads] = useState<YouTubeUploadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [connected, queued] = await Promise.all([api.getYouTubeConnections(), api.getYouTubeUploads()]);
      setConnections(connected.connections);
      setConfigured(connected.configured);
      setUploads(queued.uploads);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const active = anyActive(uploads);
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => { void load(); }, ACTIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [active, load]);

  const queue = async (request: YouTubeUploadRequest): Promise<boolean> => {
    try {
      const { upload } = await api.createYouTubeUpload(request);
      setUploads(current => [upload, ...current.filter(item => item.id !== upload.id)]);
      showToast('Video queued. It uploads over the next runs, every 15 minutes.');
      return true;
    } catch (err) {
      showToast(`Couldn't queue the video. ${(err as Error).message}`, 'error');
      return false;
    }
  };

  const act = async (id: string, action: 'cancel' | 'retry') => {
    setBusyId(id);
    try {
      const { upload } = action === 'cancel' ? await api.cancelYouTubeUpload(id) : await api.retryYouTubeUpload(id);
      setUploads(current => current.map(item => (item.id === id ? upload : item)));
      showToast(action === 'cancel' ? 'Upload cancelled' : 'Upload queued again');
    } catch (err) {
      showToast(`Couldn't ${action === 'cancel' ? 'cancel' : 'retry'} the upload. ${(err as Error).message}`, 'error');
    } finally {
      setBusyId(null);
    }
  };

  return {
    connections, configured, uploads, loading, error, reload: load, busyId,
    queue, cancel: (id: string) => act(id, 'cancel'), retry: (id: string) => act(id, 'retry'),
  };
}
