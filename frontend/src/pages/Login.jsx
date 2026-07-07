import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Login() {
    const { signIn, signUp } = useAuth();
    const navigate = useNavigate();
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        try {
            if (mode === 'login') {
                const { error } = await signIn(email, password);
                if (error) throw error;
                navigate('/');
            } else {
                const { error } = await signUp(email, password);
                if (error) throw error;
                toast.success('Account created! Sign in now (or confirm your email first if required).');
                setMode('login');
            }
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-sm">
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold tracking-tight">Twiligent</h1>
                    <p className="text-sm text-muted-foreground mt-1">Social media analytics &amp; publishing</p>
                </div>

                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg">
                            {mode === 'login' ? 'Sign in' : 'Create account'}
                        </CardTitle>
                        <CardDescription>
                            {mode === 'login'
                                ? 'Enter your credentials to access your dashboard'
                                : 'Fill in your details to get started'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading
                                    ? 'Please wait...'
                                    : mode === 'login' ? 'Sign in' : 'Create account'}
                            </Button>
                        </form>

                        <div className="mt-4 text-center">
                            <button
                                type="button"
                                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {mode === 'login'
                                    ? "Don't have an account? Sign up"
                                    : 'Already have an account? Sign in'}
                            </button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
