// the parts of a Supabase AuthError the login page reads
export interface AuthErrorLike {
  message: string;
  status?: number;
  code?: string;
}

export interface EmailErrorNotice {
  message: string;
  // true when no more codes can be emailed today, so Google sign-in is the way in
  emailLimitReached: boolean;
}

const WAIT_SECONDS = /\d+\s+seconds?/i;

const LIMIT_WITH_GOOGLE = 'Twiligent has sent all the verification emails it can today. Sign in with Google instead, or try again tomorrow.';
const WRONG_CODE = 'The code is wrong or has expired. Check it, or send a new one.';
const LIMIT_WITHOUT_GOOGLE = 'Twiligent has sent all the verification emails it can today. Try again tomorrow.';

// Supabase's own email limit and the Worker's daily cap both answer 429; the per-address cap and the short wait between codes do too,
// but those messages already say what to do and Google would not help
export function emailErrorNotice(error: AuthErrorLike, googleAvailable: boolean): EmailErrorNotice {
  const limitMessage = googleAvailable ? LIMIT_WITH_GOOGLE : LIMIT_WITHOUT_GOOGLE;
  if (error.code === 'otp_expired') return { message: WRONG_CODE, emailLimitReached: false };
  if (error.status !== 429 || WAIT_SECONDS.test(error.message)) return { message: error.message, emailLimitReached: false };
  if (error.code === 'over_email_send_rate_limit' || /sign in with google/i.test(error.message)) {
    return { message: limitMessage, emailLimitReached: true };
  }
  return { message: error.message, emailLimitReached: false };
}

// Supabase answers a sign-up for an address that already has an account with a user and no identities, and sends nothing
export function isExistingAccount(user: { identities?: unknown[] } | null | undefined): boolean {
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}

export const CODE_LENGTH = 6;

// people paste codes with spaces or dashes; only the digits count
export function cleanCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

const PASSWORD_MESSAGES: Record<string, string> = {
  same_password: 'This is already your password. Choose a different one.',
  reauthentication_needed: 'For security, sign out and sign in again, then set the password.',
};

// Supabase's weak_password message lists what the password is missing, so it is shown as it is
export function passwordErrorMessage(error: AuthErrorLike): string {
  return (error.code && PASSWORD_MESSAGES[error.code]) || error.message;
}
