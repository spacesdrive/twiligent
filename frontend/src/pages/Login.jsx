import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, BookOpen, ArrowRight, Clock, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FieldRow } from '@/components/DetailPanel';
import { Logo } from '@/components/brand/Logo';
import { YouTubeIcon, InstagramIcon, RedditIcon } from '@/components/brand/platform-icons';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { GOOGLE_CLIENT_ID } from '@/lib/googleIdentity';

const PRIVACY_URL = 'https://blog.ujjwal.fyi/privacy/';

const PLATFORMS = [
    { icon: YouTubeIcon, label: 'YouTube' },
    { icon: InstagramIcon, label: 'Instagram' },
    { icon: RedditIcon, label: 'Reddit' },
];

const COPY = {
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

export default function Login() {
    const { signIn, signUp, signInWithGoogle } = useAuth();
    const navigate = useNavigate();
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const isLogin = mode === 'login';
    const copy = COPY[mode];

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

                        {GOOGLE_CLIENT_ID && (
                            <div className="flex flex-col gap-6">
                                <GoogleSignInButton
                                    text={copy.google}
                                    onCredential={handleGoogleCredential}
                                    onError={err => toast.error(err.message)}
                                />
                                <div className="flex items-center gap-3 text-caption font-medium tracking-[0.08em] text-ink-faint uppercase" role="separator" aria-label="or continue with email">
                                    <span className="h-px flex-1 bg-divider" />
                                    or
                                    <span className="h-px flex-1 bg-divider" />
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <FieldRow label="Email" htmlFor="email">
                                <Input
                                    id="email"
                                    type="email"
                                    className="h-(--control-h-lg)"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                />
                            </FieldRow>
                            <FieldRow label="Password" htmlFor="password">
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        className="h-(--control-h-lg) pr-11"
                                        placeholder={isLogin ? 'Your password' : 'At least 6 characters'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="absolute top-1/2 right-1.5 -translate-y-1/2 text-ink-faint hover:text-ink"
                                        onClick={() => setShowPassword(v => !v)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        aria-pressed={showPassword}
                                    >
                                        {showPassword ? <EyeOff /> : <Eye />}
                                    </Button>
                                </div>
                            </FieldRow>
                            <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
                                {loading && <Spinner className="size-4" />}
                                {loading ? copy.busy : copy.submit}
                                {!loading && <ArrowRight data-icon="inline-end" />}
                            </Button>
                        </form>

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

            <BrandPanel />
        </div>
    );
}

// Decorative preview of the product; hidden from assistive technology and on small screens.
function BrandPanel() {
    return (
        <aside aria-hidden="true" className="hidden p-3 lg:block">
            <div className="sticky top-3 flex h-[calc(100svh-1.5rem)] flex-col overflow-hidden rounded-panel fold-band p-10 text-white xl:p-12">
                <img
                    src="/Logos/twiligent-mark-white.svg"
                    alt=""
                    className="pointer-events-none absolute -right-24 -bottom-28 w-[70%] max-w-[40rem] opacity-[0.07] select-none"
                    draggable={false}
                />

                <div className="relative flex items-center gap-2">
                    {PLATFORMS.map(platform => {
                        const Icon = platform.icon;
                        return (
                            <span key={platform.label} className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-white/15 bg-white/10 px-3 text-small font-medium backdrop-blur-sm">
                                <Icon className="size-3.5" />
                                {platform.label}
                            </span>
                        );
                    })}
                </div>

                <div className="relative flex min-h-0 flex-1 items-center justify-center py-8">
                    <div className="relative w-full max-w-[25rem]">
                        <div className="rounded-card border border-white/15 bg-white/10 p-5 shadow-lg backdrop-blur-md">
                            <div className="flex items-center justify-between text-small text-white/75">
                                <span>Audience</span>
                                <span className="inline-flex items-center gap-1 rounded-pill bg-white/15 px-2 py-0.5 text-caption font-medium text-white">
                                    <TrendingUp className="size-3" />
                                    12.6%
                                </span>
                            </div>
                            <p className="mt-2 font-heading text-[2.75rem] leading-none font-semibold tracking-[-0.03em] tabular-nums">128.4K</p>
                            <svg viewBox="0 0 320 72" className="mt-4 h-16 w-full" fill="none" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="login-spark" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="white" stopOpacity="0.35" />
                                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                <path d="M0 58 C30 54 48 60 72 50 S118 30 146 36 S196 44 222 26 S276 14 320 6 L320 72 L0 72 Z" fill="url(#login-spark)" />
                                <path d="M0 58 C30 54 48 60 72 50 S118 30 146 36 S196 44 222 26 S276 14 320 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                            </svg>
                        </div>

                        <div className="absolute -bottom-14 -left-10 flex w-64 items-center gap-3 rounded-card border border-white/15 bg-white/15 p-3.5 shadow-lg backdrop-blur-md xl:-left-14">
                            <span className="grid size-10 shrink-0 place-items-center rounded-control bg-white/15">
                                <InstagramIcon className="size-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-small font-semibold">Reel scheduled</p>
                                <p className="flex items-center gap-1 text-caption text-white/75"><Clock className="size-3" />Tomorrow, 09:00</p>
                            </div>
                        </div>

                        <div className="absolute -top-[4.5rem] right-10 flex items-center gap-2.5 rounded-card border border-white/15 bg-white/15 px-3.5 py-3 shadow-lg backdrop-blur-md xl:-right-10">
                            <YouTubeIcon className="size-5" />
                            <div>
                                <p className="text-caption text-white/75">Top video</p>
                                <p className="text-small font-semibold tabular-nums">1.2M views</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative flex flex-col gap-3">
                    <p className="max-w-md font-heading text-[clamp(1.75rem,min(2.8vw,5vh),2.5rem)] leading-[1.12] font-semibold tracking-[-0.025em]">
                        Every channel, folded into one clear picture.
                    </p>
                    <p className="max-w-sm text-sm text-white/75">Analytics for YouTube, Instagram and Reddit, with scheduled publishing to Instagram.</p>
                </div>
            </div>
        </aside>
    );
}
