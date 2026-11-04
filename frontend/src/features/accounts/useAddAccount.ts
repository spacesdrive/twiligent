import { useState } from 'react';
import { api } from '../../services/api';
import { channelFieldProblem, redditFieldsProblem, redditUsername } from './accountManagerData';
import type { AddAccountField, AddAccountProblem } from './accountManagerData';
import type { AppContextValue } from '../../context/AppContext';
import type { Platform } from '@shared/types/domain.ts';
import type { YouTubeChannelData } from '@shared/types/youtube.ts';
import type { AccountActionDeps } from './useAccountDelete';

type ShowToast = AppContextValue['showToast'];

const FIELD_IDS: Record<AddAccountField, string> = { channel: 'yt-channel', username: 'reddit-user', cookie: 'reddit-cookie' };

interface AddStepDeps {
  showToast: ShowToast;
  finishAdding: () => void;
  setProblem: (problem: AddAccountProblem | null) => void;
  setSubmitError: (message: string | null) => void;
}

// a problem is shown under its field and focus moves there, so the person sees what to fix without a toast
function focusProblem(problem: AddAccountProblem) {
  document.getElementById(FIELD_IDS[problem.field])?.focus();
}

function useChannelLookup(setProblem: AddStepDeps['setProblem']) {
  const [input, setInput] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<YouTubeChannelData | null>(null);

  const changeInput = (value: string) => {
    setInput(value);
    setResolved(null);
    setProblem(null);
  };

  const handleResolve = async () => {
    if (resolving) return;
    const problem = channelFieldProblem(input);
    if (problem) {
      setProblem(problem);
      focusProblem(problem);
      return;
    }
    setResolving(true);
    setResolved(null);
    try {
      const res = await api.resolveChannel(input.trim());
      setResolved(res.data || res);
      setProblem(null);
    } catch (err) {
      const found = { field: 'channel' as const, message: `Couldn't find that channel. ${(err as Error).message}` };
      setProblem(found);
      focusProblem(found);
    } finally {
      setResolving(false);
    }
  };

  const clearResolved = () => setResolved(null);
  const reset = () => {
    setResolved(null);
    setInput('');
  };

  return { input, resolving, resolved, changeInput, handleResolve, clearResolved, reset };
}

function useRedditFields(setProblem: AddStepDeps['setProblem']) {
  const [username, setUsernameValue] = useState('');
  const [cookie, setCookieValue] = useState('');

  const setUsername = (value: string) => {
    setUsernameValue(value);
    setProblem(null);
  };
  const setCookie = (value: string) => {
    setCookieValue(value);
    setProblem(null);
  };
  // a pasted profile address or u/name is shown as the plain name once the field is left
  const tidyUsername = () => setUsernameValue(current => redditUsername(current));

  const reset = () => {
    setUsernameValue('');
    setCookieValue('');
  };

  return { username, cookie, setUsername, setCookie, tidyUsername, reset };
}

function useChannelAdd({ input, showToast, finishAdding, setProblem, setSubmitError }: AddStepDeps & { input: string }) {
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (adding) return;
    const problem = channelFieldProblem(input);
    if (problem) {
      setProblem(problem);
      focusProblem(problem);
      return;
    }
    setAdding(true);
    setSubmitError(null);
    try {
      await api.addAccount(input.trim());
      showToast('YouTube channel added');
      finishAdding();
    } catch (err) {
      setSubmitError(`Couldn't add the channel. ${(err as Error).message}`);
    } finally {
      setAdding(false);
    }
  };

  return { adding, handleAdd };
}

function useRedditAdd({ username, cookie, showToast, finishAdding, setProblem, setSubmitError }: AddStepDeps & { username: string; cookie: string }) {
  const [addingReddit, setAddingReddit] = useState(false);

  const handleAddReddit = async () => {
    if (addingReddit) return;
    const problem = redditFieldsProblem(username, cookie);
    if (problem) {
      setProblem(problem);
      focusProblem(problem);
      return;
    }
    setAddingReddit(true);
    setSubmitError(null);
    const name = redditUsername(username);
    try {
      await api.addRedditAccount(name, cookie.trim());
      showToast(`u/${name} added`);
      finishAdding();
    } catch (err) {
      setSubmitError(`Couldn't add u/${name}. ${(err as Error).message}`);
    } finally {
      setAddingReddit(false);
    }
  };

  return { addingReddit, handleAddReddit };
}

function useInstagramConnect(setSubmitError: AddStepDeps['setSubmitError']) {
  const [connecting, setConnecting] = useState(false);

  const handleConnectInstagram = async () => {
    if (connecting) return;
    setConnecting(true);
    setSubmitError(null);
    try {
      const { url } = await api.getInstagramAuthUrl();
      // same tab: instagram redirects back to /accounts?ig_connected=true
      window.location.href = url;
    } catch (err) {
      setSubmitError(`Couldn't start Instagram sign-in. ${(err as Error).message}`);
      setConnecting(false);
    }
  };

  return { connecting, handleConnectInstagram };
}

export function useAddAccount({ showToast, loadAccounts }: AccountActionDeps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [platform, setPlatformValue] = useState<Platform | null>(null);
  const [problem, setProblem] = useState<AddAccountProblem | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const channel = useChannelLookup(setProblem);
  const reddit = useRedditFields(setProblem);

  const setPlatform = (value: Platform | null) => {
    setPlatformValue(value);
    setProblem(null);
    setSubmitError(null);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setPlatform(null);
    channel.reset();
    reddit.reset();
  };

  const finishAdding = () => {
    closeDialog();
    loadAccounts();
  };

  // back keeps typed channel and reddit fields; only platform and lookup reset
  const goBack = () => {
    setPlatform(null);
    channel.clearResolved();
  };

  const openWithPlatform = (value: Platform) => {
    setPlatform(value);
    setDialogOpen(true);
  };

  const deps = { showToast, finishAdding, setProblem, setSubmitError };
  const channelAdd = useChannelAdd({ input: channel.input, ...deps });
  const redditAdd = useRedditAdd({ username: reddit.username, cookie: reddit.cookie, ...deps });
  const instagram = useInstagramConnect(setSubmitError);
  const errorFor = (field: AddAccountField) => (problem?.field === field ? problem.message : undefined);

  return {
    dialogOpen, setDialogOpen, platform, setPlatform, closeDialog, goBack, openWithPlatform,
    channel, reddit, channelAdd, redditAdd, instagram, errorFor, submitError,
  };
}

export type AddAccountFlow = ReturnType<typeof useAddAccount>;
