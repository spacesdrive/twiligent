import type {
  GitHubSettingsRequest, GitHubSettingsResponse, HealthResponse, KeysStatusResponse,
} from '../../../../shared/types/domain.ts';
import { docsUrl } from '../../lib/docs.ts';

export interface DocLink {
  label: string;
  href: string;
}

export interface ExternalLink {
  label: string;
  href: string;
}

// the api methods loadServerSettings calls
export interface ServerSettingsClient {
  getKeys: () => Promise<KeysStatusResponse>;
  getGithubSettings: () => Promise<GitHubSettingsResponse>;
}

export interface ServerSettingsHandlers {
  isCancelled: () => boolean;
  applyKeys: (keys: KeysStatusResponse) => void;
  applyGithub: (owner: string, name: string) => void;
  finish: () => void;
}

export interface HealthCheckResult {
  success: boolean;
  message: string;
}

export const DOC_LINKS: DocLink[] = [
  { label: 'Using Twiligent', href: docsUrl('/use/getting-started') },
  { label: 'Run your own Twiligent', href: docsUrl('/self-host') },
  { label: 'Environment variables', href: docsUrl('/reference/environment') },
];

export const EXTERNAL_LINKS: ExternalLink[] = [
  { label: 'Supabase API keys', href: 'https://supabase.com/dashboard/project/_/settings/api-keys' },
  { label: 'Cloudinary console', href: 'https://cloudinary.com/console' },
  { label: 'Google Cloud credentials', href: 'https://console.cloud.google.com/apis/credentials' },
  { label: 'Meta app dashboard', href: 'https://developers.facebook.com/apps' },
  { label: 'Cloudflare dashboard', href: 'https://dash.cloudflare.com' },
];

async function retryKeys(
  apiClient: ServerSettingsClient,
  isCancelled: ServerSettingsHandlers['isCancelled'],
  applyKeys: ServerSettingsHandlers['applyKeys'],
): Promise<void> {
  try {
    const keys = await apiClient.getKeys();
    if (!isCancelled()) applyKeys(keys);
  } catch {
    // status is informational, the page still renders
    return;
  }
}

// a later failure keeps applied keys: the retry only replaces them on success
export async function loadServerSettings(
  apiClient: ServerSettingsClient,
  { isCancelled, applyKeys, applyGithub, finish }: ServerSettingsHandlers,
): Promise<void> {
  try {
    const [keys, github] = await Promise.all([apiClient.getKeys(), apiClient.getGithubSettings()]);
    if (isCancelled()) return;
    applyKeys(keys);
    applyGithub(github.repoOwner || '', github.repoName || '');
  } catch {
    await retryKeys(apiClient, isCancelled, applyKeys);
  } finally {
    if (!isCancelled()) finish();
  }
}

// only the repository is kept; it fills the guide links and needs no token
export function githubSettingsPayload(owner: string, repo: string): GitHubSettingsRequest {
  return { repoOwner: owner.trim(), repoName: (repo || 'twiligent').trim(), branch: 'main' };
}

export function healthCheckResult(response: Pick<HealthResponse, 'status'>): HealthCheckResult {
  if (response.status === 'ok') return { success: true, message: 'The API is reachable and healthy.' };
  return { success: false, message: `The API answered with status "${response.status}". Check the Worker logs.` };
}

export function healthCheckFailure(err: Error): HealthCheckResult {
  return { success: false, message: `The API could not be reached: ${err.message}. Check VITE_API_URL and that the Worker is deployed.` };
}
