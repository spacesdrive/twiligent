import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { githubSettingsPayload, loadServerSettings } from './settingsData';

function useGithubRepoSave({ owner, repo, showToast }) {
  const [saving, setSaving] = useState(false);

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveGithubSettings(githubSettingsPayload(owner, repo));
      showToast('GitHub username saved. The buttons in the guide now open your copy.');
    } catch (err) {
      showToast(`Couldn't save the repository. ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return { saving, handleSave };
}

export function useServerSettings(showToast) {
  const [serverStatus, setServerStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ghRepoOwner, setGhRepoOwner] = useState('');
  const [ghRepoName, setGhRepoName] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadServerSettings(api, {
      isCancelled: () => cancelled,
      applyKeys: setServerStatus,
      applyGithub: (owner, name) => {
        setGhRepoOwner(owner);
        setGhRepoName(name);
      },
      finish: () => setLoading(false),
    });
    return () => { cancelled = true; };
  }, []);

  const { saving, handleSave } = useGithubRepoSave({ owner: ghRepoOwner, repo: ghRepoName, showToast });

  return {
    serverStatus, loading,
    github: { owner: ghRepoOwner, repo: ghRepoName, setOwner: setGhRepoOwner, setRepo: setGhRepoName, saving, handleSave },
  };
}
