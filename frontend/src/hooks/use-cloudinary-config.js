import { useEffect, useState } from 'react';
import { api } from '../services/api';

async function fetchCloudinaryConfig() {
  try {
    const res = await api.getCloudinaryConfig();
    return res?.success ? res : null;
  } catch {
    // pages already show a missing config as an alert or a disabled upload field
    return null;
  }
}

// reloadKey lets a page fetch the config again when something it depends on changes
export function useCloudinaryConfig(reloadKey) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const loadConfig = async () => {
      const nextConfig = await fetchCloudinaryConfig();
      if (nextConfig) setConfig(nextConfig);
    };
    loadConfig();
  }, [reloadKey]);

  return config;
}
