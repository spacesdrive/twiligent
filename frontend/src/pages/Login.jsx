import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/Logo';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { GOOGLE_CLIENT_ID } from '@/lib/googleIdentity';
import LoginBrandPanel from './LoginBrandPanel';
import LoginForm from './LoginForm';
import { LOGIN_COPY, PRIVACY_URL } from './loginCopy';

function GoogleOption({ text, onCredential }) {
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
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // kept here, above the keyed panel, so only the mode switch link resets it
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const isLogin = mode === 'login';
  const copy = LOGIN_COPY[mode];

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate('/');
      } else {
        const { error } = await signUp(email, password);
        if (error) throw error;
        toast.success('Account created. Sign in to continue.');
        setMode('login');
      }
    } catch (err) {
      toast.error(isLogin ? `Couldn't sign in. ${err.message}` : `Couldn't create the account. ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleCredential(idToken, nonce) {
    setLoading(true);
    try {
      const { error } = await signInWithGoogle(idToken, nonce);
      if (error) throw error;
      navigate('/');
    } catch (err) {
      toast.error(`Couldn't sign in with Google. ${err.message}`);
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

            {GOOGLE_CLIENT_ID && <GoogleOption text={copy.google} onCredential={handleGoogleCredential} />}

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

            <p className="text-center text-sm text-ink-muted">
              {copy.switchPrompt}{' '}
              <button
                type="button"
                onClick={() => { setMode(isLogin ? 'signup' : 'login'); setShowPassword(false); }}
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
