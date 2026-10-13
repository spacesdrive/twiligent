import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { CloudinaryConfigResponse } from '@shared/types/instagram.ts';

async function fetchCloudinaryConfig(): Promise<CloudinaryConfigResponse | null> {
  try {
    const res = await api.getCloudinaryConfig();
    return res?.success ? res : null;
  } catch {
    // pages already show a missing config as an alert or a disabled upload field
    return null;
  }
}

// reloadKey lets a page refetch the config when something it depends on changes
export function useCloudinaryConfig(reloadKey?: unknown): CloudinaryConfigResponse | null {
  const [config, setConfig] = useState<CloudinaryConfigResponse | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      const nextConfig = await fetchCloudinaryConfig();
      if (nextConfig) setConfig(nextConfig);
    };
    loadConfig();
  }, [reloadKey]);

  return config;
}
