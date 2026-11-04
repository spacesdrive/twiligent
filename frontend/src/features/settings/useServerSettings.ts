import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../services/api';
import { githubOwner, githubRepoFromUrl, githubSettingsPayload, loadServerSettings } from './settingsData';
import type { AppContextValue } from '../../context/AppContext';
import type { KeysStatusResponse } from '@shared/types/domain.ts';

type ShowToast = AppContextValue['showToast'];

interface GithubRepoSaveDeps {
  owner: string;
  repo: string;
  onSaved: (owner: string, repo: string) => void;
  onMissingOwner: () => void;
  showToast: ShowToast;
}

function useGithubRepoSave({ owner, repo, onSaved, onMissingOwner, showToast }: GithubRepoSaveDeps) {
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    const payload = githubSettingsPayload(githubOwner(owner), repo);
    if (!payload.repoOwner) {
      onMissingOwner();
      return;
    }
    setSaving(true);
    try {
      await api.saveGithubSettings(payload);
      onSaved(payload.repoOwner, payload.repoName ?? 'twiligent');
      showToast('GitHub username saved. The buttons in the guide now open your copy.');
    } catch (err) {
      showToast(`Couldn't save the GitHub username. ${(err as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return { saving, handleSave };
}

export function useServerSettings(showToast: ShowToast) {
  const [serverStatus, setServerStatus] = useState<KeysStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [ghRepoOwner, setGhRepoOwner] = useState('');
  const [ghRepoName, setGhRepoName] = useState('');
  // the guide's links follow what is saved, not what is being typed
  const [saved, setSaved] = useState({ owner: '', repo: '' });
  const [ownerError, setOwnerError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadServerSettings(api, {
      isCancelled: () => cancelled,
      applyKeys: setServerStatus,
      applyGithub: (owner, name) => {
        setGhRepoOwner(owner);
        setGhRepoName(name);
        setSaved({ owner, repo: name });
      },
      finish: () => setLoading(false),
    });
    return () => { cancelled = true; };
  }, []);

  const { saving, handleSave } = useGithubRepoSave({
    owner: ghRepoOwner,
    repo: ghRepoName,
    onSaved: (owner, repo) => {
      setGhRepoOwner(owner);
      setGhRepoName(repo);
      setSaved({ owner, repo });
      setOwnerError(null);
    },
    onMissingOwner: () => {
      setOwnerError('Type your GitHub username, such as octocat.');
      document.getElementById('gh-user')?.focus();
    },
    showToast,
  });

  const setOwner = (value: string) => {
    setGhRepoOwner(value);
    setOwnerError(null);
  };

  // a pasted address is reduced to the user name when the field is left, and fills the repository name too
  const tidyOwner = () => {
    const repo = githubRepoFromUrl(ghRepoOwner);
    if (repo) setGhRepoName(repo);
    setGhRepoOwner(githubOwner(ghRepoOwner));
  };

  const unsaved = githubOwner(ghRepoOwner) !== saved.owner || (ghRepoName || 'twiligent') !== (saved.repo || 'twiligent');

  return {
    serverStatus, loading,
    github: {
      owner: ghRepoOwner, repo: ghRepoName, savedOwner: saved.owner, savedRepo: saved.repo, unsaved, ownerError,
      setOwner, setRepo: setGhRepoName, tidyOwner, saving, handleSave,
    },
  };
}

export type GithubRepoSettings = ReturnType<typeof useServerSettings>['github'];
