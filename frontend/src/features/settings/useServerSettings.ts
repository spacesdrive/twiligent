import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../services/api';
import { githubSettingsPayload, loadServerSettings } from './settingsData';
import type { AppContextValue } from '../../context/AppContext';
import type { KeysStatusResponse } from '@shared/types/domain.ts';

type ShowToast = AppContextValue['showToast'];

interface GithubRepoSaveDeps {
  owner: string;
  repo: string;
  showToast: ShowToast;
}

function useGithubRepoSave({ owner, repo, showToast }: GithubRepoSaveDeps) {
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveGithubSettings(githubSettingsPayload(owner, repo));
      showToast('GitHub username saved. The buttons in the guide now open your copy.');
    } catch (err) {
      showToast(`Couldn't save the repository. ${(err as Error).message}`, 'error');
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

export type GithubRepoSettings = ReturnType<typeof useServerSettings>['github'];
