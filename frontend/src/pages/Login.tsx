import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { BookOpen, MailWarning } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Logo } from '@/components/brand/Logo';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import type { GoogleButtonText } from '@/lib/googleIdentity';
import { GOOGLE_CLIENT_ID } from '@/lib/googleIdentity';
import { emailErrorNotice, isExistingAccount, passwordErrorMessage } from '@/lib/authErrors';
import { PASSWORD_MIN_LENGTH, newPasswordProblem } from '@/lib/passwords';
import { FieldRow } from '@/components/DetailPanel';
import { useCountdown } from './useCountdown';
import type { AuthErrorLike } from '@/lib/authErrors';
import LoginBrandPanel from './LoginBrandPanel';
import LoginForm from './LoginForm';
import LoginCodeForm from './LoginCodeForm';
import LoginEmailForm from './LoginEmailForm';
import PasswordInput from './PasswordInput';
import { LOGIN_COPY, PRIVACY_URL } from './loginCopy';
import type { LoginMode } from './loginCopy';
import { docsUrl } from '@/lib/docs';

interface GoogleOptionProps {
  text: GoogleButtonText;
  onCredential: (idToken: string, nonce: string) => void;
}

function GoogleOption({ text, onCredential }: GoogleOptionProps) {
  return (
    <div className="flex flex-col gap-6">
      <GoogleSignInButton
        text={text}
        onCredential={onCredential}
        onError={err => toast.error(err.message)}
      />
      <div className="flex items-center gap-3 text-caption font-medium tracking-[0.08em] text-ink-faint uppercase" role="separator" aria-label="or continue with email">
        <span className="h-px flex-1 bg-divider" />
        or
        <span className="h-px flex-1 bg-divider" />
      </div>
    </div>
  );
}

// Supabase allows one email code a minute per address, so the resend button waits as long after each send
const RESEND_WAIT_SECONDS = 60;

const FAILURE_PREFIX: Record<LoginMode, string> = {
  login: "Couldn't sign in.",
  signup: "Couldn't create the account.",
  verify: "Couldn't confirm the email.",
  forgot: "Couldn't send the code.",
  reset: "Couldn't reset the password.",
};

export default function Login() {
  const {
    signIn, signUp, verifySignUpCode, resendSignUpCode, sendPasswordReset, verifyPasswordResetCode, updatePassword, signInWithGoogle,
  } = useAuth();
  const navigate = useNavigate();
  // the public site's Get started buttons open /login?mode=signup
  const [params] = useSearchParams();
  const [mode, setMode] = useState<LoginMode>(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  // kept here, above the keyed panel, so only the mode switch link resets it
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, startResendWait] = useCountdown();
  const [emailLimitMessage, setEmailLimitMessage] = useState<string | null>(null);
  const isLogin = mode === 'login';
  const copy = LOGIN_COPY[mode];

  function openCodeStep(nextMode: 'verify' | 'reset', justSent: boolean) {
    setCode('');
    startResendWait(justSent ? RESEND_WAIT_SECONDS : 0);
    setMode(nextMode);
  }

  function showEmailError(prefix: string, err: unknown) {
    const notice = emailErrorNotice(err as AuthErrorLike, !!GOOGLE_CLIENT_ID);
    // the warning above the Google button says it already
    if (notice.emailLimitReached) setEmailLimitMessage(notice.message);
    else toast.error(`${prefix} ${notice.message}`);
  }

  async function submitLogin() {
    const { error } = await signIn(email, password);
    if (error?.code === 'email_not_confirmed') {
      openCodeStep('verify', false);
      toast.info('Confirm your email to sign in. Enter the code from your sign-up email, or send a new one.');
      return;
    }
    if (error) throw error;
    navigate('/');
  }

  async function submitSignUp() {
    const { data, error } = await signUp(email, password);
    if (error) throw error;
    // email confirmation is off in Supabase, so the account is ready
    if (data.session) {
      navigate('/');
      return;
    }
    if (isExistingAccount(data.user)) {
      toast.error('This email already has an account. Sign in instead.');
      setMode('login');
      return;
    }
    openCodeStep('verify', true);
  }

  async function submitSignUpCode() {
    const { error } = await verifySignUpCode(email, code);
    if (error) throw error;
    toast.success('Email confirmed');
    navigate('/');
  }

  // Supabase answers the same whether or not the address has an account, so the message cannot say which
  async function submitForgot() {
    const { error } = await sendPasswordReset(email);
    if (error) throw error;
    setPassword('');
    openCodeStep('reset', true);
    toast.success(`If an account uses ${email}, a code is on its way.`);
  }

  async function submitReset() {
    const problem = newPasswordProblem(password, password);
    if (problem) throw new Error(problem);
    const { error } = await verifyPasswordResetCode(email, code);
    if (error) throw error;
    // the code has signed the user in, so a refused password is fixed from Settings instead of a new code
    const { error: passwordError } = await updatePassword(password);
    if (passwordError) {
      toast.error(`You are signed in, but the new password was not saved. ${passwordErrorMessage(passwordError)} Set it in Settings.`);
      navigate('/settings');
      return;
    }
    toast.success('Password saved');
    navigate('/');
  }

  const SUBMIT: Record<LoginMode, () => Promise<void>> = {
    login: submitLogin, signup: submitSignUp, verify: submitSignUpCode, forgot: submitForgot, reset: submitReset,
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      await SUBMIT[mode]();
    } catch (err) {
      showEmailError(FAILURE_PREFIX[mode], err);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      const { error } = mode === 'reset' ? await sendPasswordReset(email) : await resendSignUpCode(email);
      if (error) throw error;
      startResendWait(RESEND_WAIT_SECONDS);
      toast.success('New code sent');
    } catch (err) {
      showEmailError("Couldn't send a new code.", err);
    } finally {
      setResending(false);
    }
  }

  function switchMode(next: LoginMode) {
    setMode(next);
    setShowPassword(false);
  }

  async function handleGoogleCredential(idToken: string, nonce: string) {
    setLoading(true);
    try {
      const { error } = await signInWithGoogle(idToken, nonce);
      if (error) throw error;
      navigate('/');
    } catch (err) {
      toast.error(`Couldn't sign in with Google. ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-svh bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-svh flex-col px-6 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Logo className="h-7" />
          <Button variant="ghost" size="sm" render={<a href={docsUrl()} />}>
            <BookOpen data-icon="inline-start" />
            Docs
          </Button>
        </header>

        <main className="flex flex-1 items-center justify-center py-12">
          <div key={mode} className="flex w-full max-w-[22.5rem] animate-fold-in flex-col gap-7">
            <div className="flex flex-col gap-2 text-center">
              <h1 className="font-heading text-[2rem] leading-tight font-semibold tracking-[-0.025em] text-ink">{copy.title}</h1>
              <p className="text-sm text-ink-muted">{copy.lead}</p>
            </div>

            {emailLimitMessage && !isLogin && (
              <Alert variant="warning">
                <MailWarning />
                <AlertTitle>Email codes are paused until tomorrow</AlertTitle>
                <AlertDescription>{emailLimitMessage}</AlertDescription>
              </Alert>
            )}

            {GOOGLE_CLIENT_ID && (mode === 'login' || mode === 'signup' || emailLimitMessage) && <GoogleOption text={copy.google} onCredential={handleGoogleCredential} />}

            {mode === 'login' || mode === 'signup' ? (
              <LoginForm
                isLogin={isLogin}
                copy={copy}
                email={email}
                password={password}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword(visible => !visible)}
                loading={loading}
                onSubmit={handleSubmit}
                onForgotPassword={isLogin ? () => switchMode('forgot') : undefined}
              />
            ) : mode === 'forgot' ? (
              <LoginEmailForm copy={copy} email={email} onEmailChange={setEmail} loading={loading} onSubmit={handleSubmit} />
            ) : (
              <LoginCodeForm
                copy={copy}
                email={email}
                code={code}
                onCodeChange={setCode}
                loading={loading}
                onSubmit={handleSubmit}
                resendIn={resendIn}
                resending={resending}
                onResend={handleResend}
                ready={mode === 'verify' || password.length >= PASSWORD_MIN_LENGTH}
              >
                {mode === 'reset' && (
                  <FieldRow label="New password" htmlFor="password">
                    <PasswordInput
                      id="password"
                      value={password}
                      onChange={setPassword}
                      placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                      autoComplete="new-password"
                      showPassword={showPassword}
                      onTogglePassword={() => setShowPassword(visible => !visible)}
                    />
                  </FieldRow>
                )}
              </LoginCodeForm>
            )}

            <p className="text-center text-sm text-ink-muted">
              {copy.switchPrompt}{' '}
              <button
                type="button"
                onClick={() => switchMode(copy.switchTo)}
                className="rounded-sm font-medium text-brand-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {copy.switchAction}
              </button>
            </p>
          </div>
        </main>

        <footer className="flex flex-col items-center gap-2 text-center text-caption text-ink-faint sm:flex-row sm:justify-between sm:text-left">
          <p>
            By continuing you agree to the{' '}
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-ink-muted">privacy policy</a>.
          </p>
          <p>&copy; {new Date().getFullYear()} Twiligent</p>
        </footer>
      </div>

      <LoginBrandPanel />
    </div>
  );
}
