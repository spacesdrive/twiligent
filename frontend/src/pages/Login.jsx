import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FieldRow } from '@/components/DetailPanel';
import { Logo } from '@/components/brand/Logo';

export default function Login() {
    const { signIn, signUp } = useAuth();
    const navigate = useNavigate();
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const isLogin = mode === 'login';

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

    return (
        <div className="grid min-h-svh bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <main className="flex flex-col px-6 py-8 sm:px-10">
                <Logo className="h-7" />
                <div className="flex flex-1 items-center justify-center py-12">
                    <div className="flex w-full max-w-sm animate-fold-in flex-col gap-8">
                        <div className="flex flex-col gap-2">
                            <h1 className="font-heading text-page-title font-semibold tracking-[-0.015em] text-ink">
                                {isLogin ? 'Sign in to Twiligent' : 'Create your account'}
                            </h1>
                            <p className="text-sm text-ink-muted">
                                {isLogin
                                    ? 'Analytics and publishing for your channels, in one place.'
                                    : 'Use an email and a password of at least 6 characters.'}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
                                    autoFocus
                                />
                            </FieldRow>
                            <FieldRow label="Password" htmlFor="password">
                                <Input
                                    id="password"
                                    type="password"
                                    className="h-(--control-h-lg)"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                                />
                            </FieldRow>
                            <Button type="submit" size="lg" className="mt-1 w-full" disabled={loading}>
                                {loading && <Spinner className="size-4" />}
                                {loading ? (isLogin ? 'Signing in' : 'Creating account') : (isLogin ? 'Sign in' : 'Create account')}
                            </Button>
                        </form>

                        <p className="text-center text-sm text-ink-muted">
                            {isLogin ? 'New to Twiligent?' : 'Already have an account?'}{' '}
                            <button
                                type="button"
                                onClick={() => setMode(isLogin ? 'signup' : 'login')}
                                className="rounded-sm font-medium text-brand-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                                {isLogin ? 'Create an account' : 'Sign in'}
                            </button>
                        </p>
                    </div>
                </div>
            </main>

            <aside aria-hidden="true" className="sticky top-0 hidden h-svh overflow-hidden fold-band lg:block">
                <img
                    src="/Logos/twiligent-mark-white.svg"
                    alt=""
                    className="absolute -top-16 -right-20 w-[58%] max-w-[36rem] opacity-[0.14] select-none"
                    draggable={false}
                />
                <div className="relative flex h-full min-h-0 flex-col justify-end gap-3 p-10 text-white xl:p-12">
                    <p className="eyebrow text-white/80">Twiligent</p>
                    <p className="max-w-md font-heading text-[clamp(1.75rem,min(3.2vw,6vh),2.75rem)] leading-[1.14] font-semibold tracking-[-0.025em]">
                        Clarity from many sources, folded into one picture.
                    </p>
                </div>
            </aside>
        </div>
    );
}
