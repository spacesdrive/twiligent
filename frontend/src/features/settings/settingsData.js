export const DOC_LINKS = [
  { label: 'Using Twiligent', to: '/docs/use/getting-started' },
  { label: 'Run your own Twiligent', to: '/docs/self-host' },
  { label: 'Environment variables', to: '/docs/reference/environment' },
];

export const EXTERNAL_LINKS = [
  { label: 'Supabase API keys', href: 'https://supabase.com/dashboard/project/_/settings/api-keys' },
  { label: 'Cloudinary console', href: 'https://cloudinary.com/console' },
  { label: 'Google Cloud credentials', href: 'https://console.cloud.google.com/apis/credentials' },
  { label: 'Meta app dashboard', href: 'https://developers.facebook.com/apps' },
  { label: 'Cloudflare dashboard', href: 'https://dash.cloudflare.com' },
];

async function retryKeys(apiClient, isCancelled, applyKeys) {
  try {
    const keys = await apiClient.getKeys();
    if (!isCancelled()) applyKeys(keys);
  } catch {
    // status is informational, the page still renders
    return;
  }
}

// a later failure keeps applied keys: the retry only replaces them on success
export async function loadServerSettings(apiClient, { isCancelled, applyKeys, applyGithub, finish }) {
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
export function githubSettingsPayload(owner, repo) {
  return { repoOwner: owner.trim(), repoName: (repo || 'twiligent').trim(), branch: 'main' };
}

export function healthCheckResult(response) {
  if (response.status === 'ok') return { success: true, message: 'The API is reachable and healthy.' };
  return { success: false, message: `The API answered with status "${response.status}". Check the Worker logs.` };
}

export function healthCheckFailure(err) {
  return { success: false, message: `The API could not be reached: ${err.message}. Check VITE_API_URL and that the Worker is deployed.` };
}
