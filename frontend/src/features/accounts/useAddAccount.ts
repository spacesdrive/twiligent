import { useState } from 'react';
import { api } from '../../services/api';

function useChannelLookup(showToast) {
  const [input, setInput] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(null);

  const changeInput = value => {
    setInput(value);
    setResolved(null);
  };

  const handleResolve = async () => {
    if (!input.trim()) return;
    setResolving(true);
    setResolved(null);
    try {
      const res = await api.resolveChannel(input.trim());
      setResolved(res.data || res);
    } catch (err) {
      showToast(`Couldn't find that channel. ${err.message}`, 'error');
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

function useRedditFields() {
  const [username, setUsername] = useState('');
  const [cookie, setCookie] = useState('');

  const reset = () => {
    setUsername('');
    setCookie('');
  };

  return { username, cookie, setUsername, setCookie, reset };
}

function useChannelAdd({ input, showToast, finishAdding }) {
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!input.trim()) return;
    setAdding(true);
    try {
      await api.addAccount(input.trim());
      showToast('YouTube channel added');
      finishAdding();
    } catch (err) {
      showToast(`Couldn't add the channel. ${err.message}`, 'error');
    } finally {
      setAdding(false);
    }
  };

  return { adding, handleAdd };
}

function useRedditAdd({ username, cookie, showToast, finishAdding }) {
  const [addingReddit, setAddingReddit] = useState(false);

  const handleAddReddit = async () => {
    if (!username.trim() || !cookie.trim()) return;
    setAddingReddit(true);
    try {
      await api.addRedditAccount(username.trim(), cookie.trim());
      showToast('Reddit account added');
      finishAdding();
    } catch (err) {
      showToast(`Couldn't add the Reddit account. ${err.message}`, 'error');
    } finally {
      setAddingReddit(false);
    }
  };

  return { addingReddit, handleAddReddit };
}

function useInstagramConnect(showToast) {
  const [connecting, setConnecting] = useState(false);

  const handleConnectInstagram = async () => {
    setConnecting(true);
    try {
      const { url } = await api.getInstagramAuthUrl();
      // same tab: instagram redirects back to /accounts?ig_connected=true
      window.location.href = url;
    } catch (err) {
      showToast(`Couldn't start Instagram sign-in. ${err.message}`, 'error');
      setConnecting(false);
    }
  };

  return { connecting, handleConnectInstagram };
}

export function useAddAccount({ showToast, loadAccounts }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [platform, setPlatform] = useState(null);
  const channel = useChannelLookup(showToast);
  const reddit = useRedditFields();

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

  const openWithPlatform = value => {
    setPlatform(value);
    setDialogOpen(true);
  };

  const channelAdd = useChannelAdd({ input: channel.input, showToast, finishAdding });
  const redditAdd = useRedditAdd({ username: reddit.username, cookie: reddit.cookie, showToast, finishAdding });
  const instagram = useInstagramConnect(showToast);

  return {
    dialogOpen, setDialogOpen, platform, setPlatform, closeDialog, goBack, openWithPlatform,
    channel, reddit, channelAdd, redditAdd, instagram,
  };
}
