import type { McpPermission } from '@shared/types/mcp.ts';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// what each choice on the consent page lets the app do, in the person's words
export const CONSENT_ABILITIES: Record<McpPermission, string[]> = {
  read: [
    'See your connected accounts, analytics, imported media and scheduled posts',
    'See your settings, without any keys or tokens',
  ],
  write: [
    'Everything read only allows',
    'Import images and videos from a public link, and rename or delete them',
    'Schedule, edit and cancel Instagram posts; Claude asks you to confirm before it schedules, cancels or deletes anything',
    'Change your GitHub scheduling settings',
  ],
};

// the app returns the person to this address with a sign-in code, so it must be https, or http on this computer
// for desktop clients that listen locally
export function isSafeRedirect(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === 'https:') return true;
  return parsed.protocol === 'http:' && LOCAL_HOSTS.has(parsed.hostname);
}

// the site the person goes back to, shown so a look-alike app name cannot hide where the code is sent
export function redirectHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
