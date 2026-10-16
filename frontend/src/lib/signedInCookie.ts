// the public site is another origin and cannot read the app's session, so the app leaves a cookie on the shared
// domain saying only that someone is signed in, never a token; site/index.html then opens the dashboard
export const SIGNED_IN_COOKIE = 'twiligent_signed_in';
const SHARED_DOMAIN = 'twiligent.ujjwal.fyi';
// renewed on every load while signed in, and cleared as soon as the session ends
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// the text to assign to document.cookie, or null when the app runs anywhere else (self-hosted, local)
export function signedInCookie(hostname: string, signedIn: boolean): string | null {
  if (hostname !== SHARED_DOMAIN && !hostname.endsWith(`.${SHARED_DOMAIN}`)) return null;
  const value = signedIn ? `1; Max-Age=${MAX_AGE_SECONDS}` : '; Max-Age=0';
  return `${SIGNED_IN_COOKIE}=${value}; Domain=${SHARED_DOMAIN}; Path=/; SameSite=Lax; Secure`;
}
