import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { readYouTubeReturn } from '../youtube/youtubeUploadData';
import { verifyReturnError } from './youtubePublishingState';
import type { AppContextValue } from '../../context/AppContext';
import type { YouTubeConnectionSummary } from '@shared/types/youtubePublishing.ts';

type ShowToast = AppContextValue['showToast'];

// publishing status for the YouTube cards on the Accounts page: verifying a channel and turning its publishing off
export function useYouTubeConnections(showToast: ShowToast) {
  const [connections, setConnections] = useState<YouTubeConnectionSummary[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
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

  // a finished Google sign-in: the server verifies the channel only if this person started it from that channel's card
  useEffect(() => {
    const returned = readYouTubeReturn(window.location.hash);
    if (!returned || completing.current) return;
    completing.current = true;
    // out of the address at once, so a reload or a shared link never carries the code
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    api.completeYouTubeConnection(returned.code, returned.state)
      .then(({ outcome, connection }) => {
        const name = connection.channelTitle || 'The channel';
        showToast(outcome === 'reconnected' ? `${name} verified again` : `${name} verified for publishing`);
        void load();
      })
      .catch((err: unknown) => showToast(`Couldn't verify the channel. ${(err as Error).message}`, 'error'));
  }, [showToast, load]);

  useEffect(() => {
    const message = verifyReturnError(searchParams);
    if (!message) return;
    showToast(message, 'error');
    const next = new URLSearchParams(searchParams);
    next.delete('yt_error');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, showToast]);

  const verify = async (accountId: string) => {
    setVerifyingId(accountId);
    try {
      const { url } = await api.getYouTubeAuthUrl(accountId);
      window.location.assign(url);
    } catch (err) {
      showToast(`Couldn't start verifying the channel. ${(err as Error).message}`, 'error');
      setVerifyingId(null);
    }
  };

  const turnOff = async (connection: YouTubeConnectionSummary): Promise<boolean> => {
    setRemovingId(connection.id);
    try {
      await api.deleteYouTubeConnection(connection.id);
      setConnections(current => current.filter(item => item.id !== connection.id));
      showToast(`Publishing turned off for ${connection.channelTitle || 'the channel'}`);
      return true;
    } catch (err) {
      showToast(`Couldn't turn off publishing. ${(err as Error).message}`, 'error');
      return false;
    } finally {
      setRemovingId(null);
    }
  };

  return { connections, configured, loading, error, reload: load, verifyingId, verify, removingId, turnOff };
}
