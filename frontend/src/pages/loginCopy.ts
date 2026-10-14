import type { GoogleButtonText } from '@/lib/googleIdentity';

export const PRIVACY_URL = 'https://blog.ujjwal.fyi/privacy/';

// verify is the code step after sign-up, or after signing in with an email that is not confirmed yet;
// forgot asks for the email of a forgotten password, and reset takes the emailed code and the new password
export type LoginMode = 'login' | 'signup' | 'verify' | 'forgot' | 'reset';

export interface LoginCopy {
  title: string;
  lead: string;
  submit: string;
  busy: string;
  switchPrompt: string;
  switchAction: string;
  // where the link under the form goes
  switchTo: LoginMode;
  google: GoogleButtonText;
}

export const LOGIN_COPY: Record<LoginMode, LoginCopy> = {
  login: {
    title: 'Welcome back',
    lead: 'Sign in to see every channel in one place.',
    submit: 'Sign in',
    busy: 'Signing in',
    switchPrompt: 'New to Twiligent?',
    switchAction: 'Create an account',
    switchTo: 'signup',
    google: 'continue_with',
  },
  signup: {
    title: 'Create your account',
    lead: 'Start with Google, or use an email and a password of at least 6 characters.',
    submit: 'Create account',
    busy: 'Creating account',
    switchPrompt: 'Already have an account?',
    switchAction: 'Sign in',
    switchTo: 'login',
    google: 'signup_with',
  },
  verify: {
    title: 'Check your email',
    lead: 'Enter the 6-digit code we emailed you to confirm your address.',
    submit: 'Confirm email',
    busy: 'Confirming',
    switchPrompt: 'Wrong address?',
    switchAction: 'Start again',
    switchTo: 'signup',
    google: 'continue_with',
  },
  forgot: {
    title: 'Reset your password',
    lead: 'Enter the email you sign in with. We will email you a 6-digit code.',
    submit: 'Send code',
    busy: 'Sending',
    switchPrompt: 'Remembered it?',
    switchAction: 'Back to sign in',
    switchTo: 'login',
    google: 'continue_with',
  },
  reset: {
    title: 'Choose a new password',
    lead: 'Enter the code we emailed you and the password you want to use from now on.',
    submit: 'Save password and sign in',
    busy: 'Saving',
    switchPrompt: 'Remembered it?',
    switchAction: 'Back to sign in',
    switchTo: 'login',
    google: 'continue_with',
  },
};
