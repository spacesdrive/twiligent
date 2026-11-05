// what the sign-in page does: wait while the stored session loads, open the dashboard for a session that was
// already there, and otherwise show the form; a session made by a sign-in on the page is left to that sign-in,
// so a password reset saves the new password before it leaves
export type SignInPageOutcome = 'wait' | 'dashboard' | 'form';

export function signInPageOutcome(hasSession: boolean | undefined, signingIn: boolean): SignInPageOutcome {
  if (hasSession === undefined) return 'wait';
  return hasSession && !signingIn ? 'dashboard' : 'form';
}

// where to go after signing in: only a path on this site, so a crafted link cannot send a fresh session elsewhere
export function returnPath(next: string | null): string {
  // browsers read a leading // or /\ as another host
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  // whitespace and control characters never appear in the app's own paths
  if (/[\s\p{Cc}]/u.test(next)) return '/';
  return next;
}

// the sign-in address that brings a person back to the page they asked for
export function signInPathFor(path: string): string {
  return path === '/' ? '/login' : `/login?next=${encodeURIComponent(path)}`;
}
