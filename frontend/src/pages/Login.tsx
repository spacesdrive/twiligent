import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, MailWarning } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Logo } from '@/components/brand/Logo';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { GOOGLE_CLIENT_ID } from '@/lib/googleIdentity';
import { emailErrorNotice, isExistingAccount, passwordErrorMessage } from '@/lib/authErrors';
import type { AuthErrorLike } from '@/lib/authErrors';
import { PASSWORD_MIN_LENGTH, newPasswordProblem } from '@/lib/passwords';
import { CODE_LENGTH } from '@/lib/authErrors';
import { looksLikeEmail } from '@/lib/emailAddress';
import { returnPath, signInPageOutcome } from '@/lib/signInPage';
import { FieldRow } from '@/components/DetailPanel';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useCountdown } from './useCountdown';
import LoginEmailStart from './LoginEmailStart';
import LoginPasswordForm from './LoginPasswordForm';
import LoginCodeForm from './LoginCodeForm';
import LoginEmailForm from './LoginEmailForm';
import PasswordInput from './PasswordInput';
import { FAILURE_FIELD, LOGIN_COPY, PRIVACY_URL, SIGN_UP_TITLE } from './loginCopy';
import type { LoginField, LoginView } from './loginCopy';

// the dashboard picture behind the card is decoration, so it loads after the card and never delays signing in
const LoginBackdrop = lazy(() => import('./LoginBackdrop'));

// Supabase allows one email code a minute per address, so the resend button waits as long after each send
const RESEND_WAIT_SECONDS = 60;

const FAILURE_PREFIX: Record<LoginView, string> = {
  start: "Couldn't send the code.",
  code: "Couldn't sign in.",
  password: "Couldn't sign in.",
  signup: "Couldn't create the account.",
  verify: "Couldn't confirm the email.",
  forgot: "Couldn't send the code.",
  reset: "Couldn't reset the password.",
};

// where Back goes from each view
const BACK_TO: Partial<Record<LoginView, LoginView>> = {
  code: 'start',
  password: 'start',
  signup: 'start',
  verify: 'start',
  forgot: 'password',
  reset: 'password',
};

function OrDivider() {
  return (
    <div className="my-4 flex items-center gap-3 text-sm text-ink-muted" role="separator" aria-label="or continue with email">
      <span className="h-px flex-1 bg-line-strong/60" />
      or
      <span className="h-px flex-1 bg-line-strong/60" />
    </div>
  );
}

const QUIET_LINK =
  'inline-flex min-h-6 items-center rounded-sm text-small text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const VIEWS_WITH_EMAIL: LoginView[] = ['start', 'password', 'signup', 'forgot'];
const VIEWS_WITH_CODE: LoginView[] = ['code', 'verify', 'reset'];

export interface LoginProblem {
  field: LoginField;
  message: string;
}

// what is missing before a view can be sent, or null; checked on submit so the button never greys out silently
function loginProblem(view: LoginView, email: string, code: string, password: string): LoginProblem | null {
  if (VIEWS_WITH_EMAIL.includes(view) && !looksLikeEmail(email)) {
    return { field: 'email', message: 'Enter your full email address, such as you@example.com.' };
  }
  if ((view === 'password' || view === 'signup') && !password) return { field: 'password', message: 'Enter your password.' };
  if (view === 'signup') {
    const problem = newPasswordProblem(password, password);
    if (problem) return { field: 'password', message: problem };
  }
  if (VIEWS_WITH_CODE.includes(view) && code.length !== CODE_LENGTH) {
    return { field: 'code', message: `Enter the ${CODE_LENGTH}-digit code from the email.` };
  }
  if (view === 'reset') {
    const problem = newPasswordProblem(password, password);
    if (problem) return { field: 'password', message: problem };
  }
  return null;
}

const FIELD_IDS: Record<LoginField, string> = { email: 'email', code: 'code', password: 'password' };

// the Activepieces sign-in in Twiligent's brand: one card over a blurred picture of the app, Google first,
// then an email that receives a sign-in code, with the password behind a quiet link
export default function Login() {
  const {
    session, signIn, signUp, verifySignUpCode, resendSignUpCode, sendSignInCode, verifySignInCode, sendPasswordReset, verifyPasswordResetCode,
    updatePassword, signInWithGoogle,
  } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const signingUp = params.get('mode') === 'signup';
  // a page that needed a sign-in, such as the Claude consent page, gets the person back after it
  const returnTo = returnPath(params.get('next'));
  const [view, setView] = useState<LoginView>('start');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, startResendWait] = useCountdown();
  const [emailLimitMessage, setEmailLimitMessage] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [problem, setProblem] = useState<LoginProblem | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstView = useRef(true);
  const copy = LOGIN_COPY[view];
  const errorFor = (field: LoginField) => (problem?.field === field ? problem.message : undefined);

  // the button that changed the view is gone; when the new view does not focus a field itself, its title takes focus
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (!document.activeElement || document.activeElement === document.body) titleRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [view]);

  function changeEmail(value: string) {
    setEmail(value);
    if (problem?.field === 'email') setProblem(null);
  }

  function changePassword(value: string) {
    setPassword(value);
    if (problem?.field === 'password') setProblem(null);
  }

  function changeCode(value: string) {
    setCode(value);
    if (problem?.field === 'code') setProblem(null);
  }

  function showProblem(found: LoginProblem) {
    setProblem(found);
    requestAnimationFrame(() => document.getElementById(FIELD_IDS[found.field])?.focus());
  }
  const title = view === 'start' && signingUp ? SIGN_UP_TITLE : copy.title;
  useDocumentTitle(view === 'start' ? (signingUp ? 'Create an account' : 'Sign in') : copy.title);
  const back = BACK_TO[view];

  function showView(next: LoginView) {
    setView(next);
    setShowPassword(false);
    setProblem(null);
  }

  function openCodeStep(next: 'code' | 'verify' | 'reset') {
    setCode('');
    startResendWait(RESEND_WAIT_SECONDS);
    showView(next);
  }

  // a failure is shown under the field it concerns and stays there until that field changes
  function showEmailError(prefix: string, err: unknown, field: LoginField) {
    const notice = emailErrorNotice(err as AuthErrorLike, !!GOOGLE_CLIENT_ID);
    // the warning on the first view says it already, next to the ways in that still work
    if (notice.emailLimitReached) {
      setEmailLimitMessage(notice.message);
      showView('start');
    } else {
      showProblem({ field, message: `${prefix} ${notice.message}` });
    }
  }

  async function submitStart() {
    const { error } = await sendSignInCode(email.trim());
    if (error) throw error;
    openCodeStep('code');
  }

  async function submitCode() {
    const { error } = await verifySignInCode(email.trim(), code);
    if (error) throw error;
    navigate(returnTo);
  }

  async function submitPassword() {
    const { error } = await signIn(email.trim(), password);
    // an address that signed up with a password and never confirmed it is confirmed by a sign-in code
    if (error?.code === 'email_not_confirmed') {
      const { error: sendError } = await sendSignInCode(email.trim());
      if (sendError) throw sendError;
      openCodeStep('code');
      toast.info('Confirm your email to sign in. Enter the code we just sent.');
      return;
    }
    if (error) throw error;
    navigate(returnTo);
  }

  async function submitSignUp() {
    const { data, error } = await signUp(email.trim(), password);
    if (error) throw error;
    // with Confirm email off the account is ready at once
    if (data.session) {
      navigate(returnTo);
      return;
    }
    if (isExistingAccount(data.user)) {
      showView('password');
      showProblem({ field: 'password', message: 'This email already has an account. Enter its password to sign in.' });
      return;
    }
    openCodeStep('verify');
  }

  async function submitSignUpCode() {
    const { error } = await verifySignUpCode(email.trim(), code);
    if (error) throw error;
    toast.success('Email confirmed');
    navigate(returnTo);
  }

  // Supabase answers the same whether or not the address has an account, so the message cannot say which
  async function submitForgot() {
    const { error } = await sendPasswordReset(email.trim());
    if (error) throw error;
    setPassword('');
    openCodeStep('reset');
    toast.success(`If an account uses ${email.trim()}, a code is on its way.`);
  }

  async function submitReset() {
    const problem = newPasswordProblem(password, password);
    if (problem) throw new Error(problem);
    const { error } = await verifyPasswordResetCode(email.trim(), code);
    if (error) throw error;
    // the code has signed the user in, so a refused password is fixed from Settings instead of a new code
    const { error: passwordError } = await updatePassword(password);
    if (passwordError) {
      toast.error(`You are signed in, but the new password was not saved. ${passwordErrorMessage(passwordError)} Set it in Settings.`);
      navigate('/settings');
      return;
    }
    toast.success('Password saved');
    navigate(returnTo);
  }

  const SUBMIT: Record<LoginView, () => Promise<void>> = {
    start: submitStart,
    code: submitCode,
    password: submitPassword,
    signup: submitSignUp,
    verify: submitSignUpCode,
    forgot: submitForgot,
    reset: submitReset,
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const found = loginProblem(view, email.trim(), code, password);
    if (found) {
      showProblem(found);
      return;
    }
    setProblem(null);
    setSigningIn(true);
    setLoading(true);
    try {
      await SUBMIT[view]();
    } catch (err) {
      showEmailError(FAILURE_PREFIX[view], err, FAILURE_FIELD[view]);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resending) return;
    setResending(true);
    try {
      const address = email.trim();
      const { error } =
        view === 'reset'
          ? await sendPasswordReset(address)
          : view === 'verify'
            ? await resendSignUpCode(address)
            : await sendSignInCode(address);
      if (error) throw error;
      startResendWait(RESEND_WAIT_SECONDS);
      toast.success('New code sent');
    } catch (err) {
      showEmailError("Couldn't send a new code.", err, 'code');
    } finally {
      setResending(false);
    }
  }

  async function handleGoogleCredential(idToken: string, nonce: string) {
    setSigningIn(true);
    setLoading(true);
    try {
      const { error } = await signInWithGoogle(idToken, nonce);
      if (error) throw error;
      navigate(returnTo);
    } catch (err) {
      setProblem({ field: 'email', message: `Couldn't sign in with Google. ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  }

  // the public site's Sign in and Get started buttons land here, so a stored session opens the dashboard
  const outcome = signInPageOutcome(session === undefined ? undefined : !!session, signingIn);
  if (outcome === 'wait') return <p role="status" className="sr-only">Checking whether you are signed in</p>;
  if (outcome === 'dashboard') return <Navigate to={returnTo} replace />;

  return (
    <div className="relative min-h-svh bg-surface">
      <Suspense fallback={null}>
        <LoginBackdrop />
      </Suspense>
      <div aria-hidden="true" className="fixed inset-0 bg-surface/70 backdrop-blur-[3px]" />
      <main className="relative flex min-h-svh items-center justify-center p-4">
        <section
          aria-labelledby="login-title"
          className="w-full max-w-[26rem] animate-in rounded-dialog border border-line bg-popover p-8 text-popover-foreground shadow-lg duration-(--duration-overlay) fade-in zoom-in-95 sm:p-9"
        >
          <div key={view} className="flex animate-in flex-col duration-200 fade-in">
            <Logo className="mx-auto h-7" />
            {back && (
              <button type="button" onClick={() => showView(back)} className={`mx-auto mt-5 flex items-center gap-1 ${QUIET_LINK}`}>
                <ArrowLeft className="size-3.5" />
                Back
              </button>
            )}
            <h1
              ref={titleRef}
              id="login-title"
              tabIndex={-1}
              className="mt-6 mb-6 text-center font-heading text-page-title font-semibold text-balance text-ink outline-none"
            >
              {title}
            </h1>

            {view === 'start' && (
              <>
                {emailLimitMessage && (
                  <Alert variant="warning" className="mb-5" role="alert">
                    <MailWarning />
                    <AlertTitle>Email codes are paused until tomorrow</AlertTitle>
                    <AlertDescription>{emailLimitMessage}</AlertDescription>
                  </Alert>
                )}
                {GOOGLE_CLIENT_ID && (
                  <>
                    <GoogleSignInButton
                      text={signingUp ? 'signup_with' : 'continue_with'}
                      onCredential={handleGoogleCredential}
                      onError={err => setProblem({ field: 'email', message: `Couldn't sign in with Google. ${err.message}` })}
                    />
                    <OrDivider />
                  </>
                )}
                <LoginEmailStart email={email} onEmailChange={changeEmail} loading={loading} onSubmit={handleSubmit} error={errorFor('email')} />
                <button type="button" onClick={() => showView('password')} className={`mx-auto mt-5 ${QUIET_LINK}`}>
                  Use password
                </button>
                <p className="mt-8 border-t border-line-strong/60 pt-5 text-center text-caption text-ink-muted">
                  By continuing, you agree to the{' '}
                  <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-ink">
                    privacy policy
                  </a>
                  .
                </p>
              </>
            )}

            {(view === 'password' || view === 'signup') && (
              <LoginPasswordForm
                isSignUp={view === 'signup'}
                copy={copy}
                email={email}
                password={password}
                onEmailChange={changeEmail}
                onPasswordChange={changePassword}
                emailError={errorFor('email')}
                passwordError={errorFor('password')}
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword(visible => !visible)}
                loading={loading}
                onSubmit={handleSubmit}
                onForgotPassword={() => showView('forgot')}
                onSwitch={() => showView(view === 'signup' ? 'password' : 'signup')}
              />
            )}

            {view === 'forgot' && (
              <LoginEmailForm copy={copy} email={email} onEmailChange={changeEmail} loading={loading} onSubmit={handleSubmit} error={errorFor('email')} />
            )}

            {(view === 'code' || view === 'verify' || view === 'reset') && (
              <LoginCodeForm
                copy={copy}
                email={email.trim()}
                code={code}
                onCodeChange={changeCode}
                error={errorFor('code')}
                loading={loading}
                onSubmit={handleSubmit}
                resendIn={resendIn}
                resending={resending}
                onResend={handleResend}
              >
                {view === 'reset' && (
                  <FieldRow label="New password" htmlFor="password" hint={`At least ${PASSWORD_MIN_LENGTH} characters.`} error={errorFor('password')}>
                    <PasswordInput
                      id="password"
                      value={password}
                      onChange={changePassword}
                      placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                      autoComplete="new-password"
                      showPassword={showPassword}
                      onTogglePassword={() => setShowPassword(visible => !visible)}
                    />
                  </FieldRow>
                )}
              </LoginCodeForm>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
