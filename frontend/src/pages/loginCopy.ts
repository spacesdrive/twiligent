import type { GoogleButtonText } from '@/lib/googleIdentity';

export const PRIVACY_URL = 'https://blog.ujjwal.fyi/privacy/';

export type LoginMode = 'login' | 'signup';

export interface LoginCopy {
  title: string;
  lead: string;
  submit: string;
  busy: string;
  switchPrompt: string;
  switchAction: string;
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
    google: 'continue_with',
  },
  signup: {
    title: 'Create your account',
    lead: 'Start with Google, or use an email and a password of at least 6 characters.',
    submit: 'Create account',
    busy: 'Creating account',
    switchPrompt: 'Already have an account?',
    switchAction: 'Sign in',
    google: 'signup_with',
  },
};
