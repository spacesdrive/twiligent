export const PRIVACY_URL = 'https://blog.ujjwal.fyi/privacy/';

// start takes an email for a sign-in code, code checks that code, password is the email and password sign-in;
// signup makes a password account and verify takes the code that confirms it, for instances without sign-in codes;
// forgot asks for the email of a forgotten password, and reset takes the emailed code and the new password
export type LoginView = 'start' | 'code' | 'password' | 'signup' | 'verify' | 'forgot' | 'reset';

export interface LoginCopy {
  title: string;
  submit: string;
  busy: string;
}

export const LOGIN_COPY: Record<LoginView, LoginCopy> = {
  start: { title: 'Every channel, folded into one clear picture.', submit: 'Continue', busy: 'Sending code' },
  code: { title: 'Check your email', submit: 'Continue', busy: 'Checking' },
  password: { title: 'Sign in with password', submit: 'Sign in', busy: 'Signing in' },
  signup: { title: 'Create an account with a password', submit: 'Create account', busy: 'Creating account' },
  verify: { title: 'Confirm your email', submit: 'Confirm email', busy: 'Confirming' },
  forgot: { title: 'Reset your password', submit: 'Send code', busy: 'Sending' },
  reset: { title: 'Choose a new password', submit: 'Save password and sign in', busy: 'Saving' },
};

// the public site's Get started buttons open /login?mode=signup; the same code creates the account
export const SIGN_UP_TITLE = 'Create your Twiligent account';
