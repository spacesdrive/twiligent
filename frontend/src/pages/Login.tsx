import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { BookOpen, MailWarning } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Logo } from '@/components/brand/Logo';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import type { GoogleButtonText } from '@/lib/googleIdentity';
import { GOOGLE_CLIENT_ID } from '@/lib/googleIdentity';
import { emailErrorNotice, isExistingAccount } from '@/lib/authErrors';
import type { AuthErrorLike } from '@/lib/authErrors';
import LoginBrandPanel from './LoginBrandPanel';
import LoginForm from './LoginForm';
import LoginCodeForm from './LoginCodeForm';
import { LOGIN_COPY, PRIVACY_URL } from './loginCopy';
import type { LoginMode } from './loginCopy';

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

export default function Login() {
  const { signIn, signUp, verifySignUpCode, resendSignUpCode, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<LoginMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  // kept here, above the keyed panel, so only the mode switch link resets it
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [emailLimitMessage, setEmailLimitMessage] = useState<string | null>(null);
  const isLogin = mode === 'login';
  const copy = LOGIN_COPY[mode];

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(seconds => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // Supabase allows one code a minute per address, so the button waits as long after each send
  function openCodeStep(justSent: boolean) {
    setCode('');
    setResendIn(justSent ? 60 : 0);
    setMode('verify');
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
      openCodeStep(false);
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
    openCodeStep(true);
  }

  async function submitCode() {
    const { error } = await verifySignUpCode(email, code);
    if (error) throw error;
    toast.success('Email confirmed');
    navigate('/');
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'verify') await submitCode();
      else if (isLogin) await submitLogin();
      else await submitSignUp();
    } catch (err) {
      const prefix = { login: "Couldn't sign in.", signup: "Couldn't create the account.", verify: "Couldn't confirm the email." }[mode];
      showEmailError(prefix, err);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      const { error } = await resendSignUpCode(email);
      if (error) throw error;
      setResendIn(60);
      toast.success('New code sent');
    } catch (err) {
      showEmailError("Couldn't send a new code.", err);
    } finally {
      setResending(false);
    }
  }

  function switchMode() {
    setMode(mode === 'signup' ? 'login' : 'signup');
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
          <Button variant="ghost" size="sm" render={<Link to="/docs" />}>
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

            {GOOGLE_CLIENT_ID && (mode !== 'verify' || emailLimitMessage) && <GoogleOption text={copy.google} onCredential={handleGoogleCredential} />}

            {mode === 'verify' ? (
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
              />
            ) : (
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
              />
            )}

            <p className="text-center text-sm text-ink-muted">
              {copy.switchPrompt}{' '}
              <button
                type="button"
                onClick={switchMode}
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
