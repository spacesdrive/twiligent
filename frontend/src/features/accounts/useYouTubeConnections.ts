import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { readYouTubeReturn, youtubeReturnError } from '../youtube/youtubeUploadData';
import type { AppContextValue } from '../../context/AppContext';
import type { YouTubeConnectionSummary } from '@shared/types/youtubePublishing.ts';

type ShowToast = AppContextValue['showToast'];

export function useYouTubeConnections(showToast: ShowToast) {
  const [connections, setConnections] = useState<YouTubeConnectionSummary[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  // the code works once, so a second run of the effect must not send it again
  const completing = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const answer = await api.getYouTubeConnections();
      setConnections(answer.connections);
      setConfigured(answer.configured);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // a finished Google sign-in: the server connects the channel only if this person started it
  useEffect(() => {
    const returned = readYouTubeReturn(window.location.hash);
    if (!returned || completing.current) return;
    completing.current = true;
    // out of the address at once, so a reload or a shared link never carries the code
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    api.completeYouTubeConnection(returned.code, returned.state)
      .then(({ outcome, connection }) => {
        showToast(`${connection.channelTitle || 'YouTube channel'} ${outcome === 'reconnected' ? 'reconnected' : 'connected'} for publishing`);
        void load();
      })
      .catch((err: unknown) => showToast(`Couldn't connect YouTube. ${(err as Error).message}`, 'error'));
  }, [showToast, load]);

  useEffect(() => {
    const message = youtubeReturnError(searchParams);
    if (!message) return;
    showToast(message, 'error');
    const next = new URLSearchParams(searchParams);
    next.delete('yt_error');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, showToast]);

  const connect = async () => {
    setConnecting(true);
    try {
      const { url } = await api.getYouTubeAuthUrl();
      window.location.assign(url);
    } catch (err) {
      showToast(`Couldn't start connecting YouTube. ${(err as Error).message}`, 'error');
      setConnecting(false);
    }
  };

  const disconnect = async (connection: YouTubeConnectionSummary): Promise<boolean> => {
    setRemovingId(connection.id);
    try {
      await api.deleteYouTubeConnection(connection.id);
      setConnections(current => current.filter(item => item.id !== connection.id));
      showToast(`${connection.channelTitle || 'YouTube channel'} disconnected`);
      return true;
    } catch (err) {
      showToast(`Couldn't disconnect the channel. ${(err as Error).message}`, 'error');
      return false;
    } finally {
      setRemovingId(null);
    }
  };

  return { connections, configured, loading, error, reload: load, connecting, connect, removingId, disconnect };
}
