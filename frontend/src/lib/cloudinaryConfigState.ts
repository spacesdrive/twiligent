import type { CloudinaryConfigResponse } from '../../../shared/types/instagram.ts';

// loading, ready and failed are separate, so a slow or failed request never reads as a server without Cloudinary
export interface CloudinaryConfigState {
  config: CloudinaryConfigResponse | null;
  loading: boolean;
  error: string | null;
}

export const CLOUDINARY_LOADING: CloudinaryConfigState = { config: null, loading: true, error: null };

export type CloudinaryConfigResult = { ok: true; config: CloudinaryConfigResponse } | { ok: false; message: string };

// a refetch that fails keeps the config already loaded, since uploads still work with it
export function nextCloudinaryState(previous: CloudinaryConfigState, result: CloudinaryConfigResult): CloudinaryConfigState {
  if (result.ok) return { config: result.config, loading: false, error: null };
  if (previous.config) return { ...previous, loading: false };
  return { config: null, loading: false, error: result.message };
}
