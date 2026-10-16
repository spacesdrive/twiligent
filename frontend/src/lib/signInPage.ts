// what the sign-in page does: wait while the stored session loads, open the dashboard for a session that was
// already there, and otherwise show the form; a session made by a sign-in on the page is left to that sign-in,
// so a password reset saves the new password before it leaves
export type SignInPageOutcome = 'wait' | 'dashboard' | 'form';

export function signInPageOutcome(hasSession: boolean | undefined, signingIn: boolean): SignInPageOutcome {
  if (hasSession === undefined) return 'wait';
  return hasSession && !signingIn ? 'dashboard' : 'form';
}
