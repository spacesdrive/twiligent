import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { CLOUDINARY_LOADING, nextCloudinaryState } from '../lib/cloudinaryConfigState';
import type { CloudinaryConfigResult, CloudinaryConfigState } from '../lib/cloudinaryConfigState';

async function fetchCloudinaryConfig(): Promise<CloudinaryConfigResult> {
  try {
    return { ok: true, config: await api.getCloudinaryConfig() };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

// reloadKey lets a page refetch the config when something it depends on changes
export function useCloudinaryConfig(reloadKey?: unknown): CloudinaryConfigState & { retry: () => void } {
  const [state, setState] = useState<CloudinaryConfigState>(CLOUDINARY_LOADING);

  useEffect(() => {
    // an answer that arrives after the page left is dropped
    let current = true;
    void fetchCloudinaryConfig().then(result => {
      if (current) setState(previous => nextCloudinaryState(previous, result));
    });
    return () => { current = false; };
  }, [reloadKey]);

  const retry = useCallback(() => {
    setState(previous => ({ ...previous, loading: true }));
    void fetchCloudinaryConfig().then(result => setState(previous => nextCloudinaryState(previous, result)));
  }, []);

  return { ...state, retry };
}
