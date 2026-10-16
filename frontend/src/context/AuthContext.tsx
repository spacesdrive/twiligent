import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { signedInCookie } from '../lib/signedInCookie';

type Auth = typeof supabase.auth;

export interface AuthContextValue {
    session: Session | null | undefined;
    user: User | null;
    signIn: (email: string, password: string) => ReturnType<Auth['signInWithPassword']>;
    signUp: (email: string, password: string) => ReturnType<Auth['signUp']>;
    verifySignUpCode: (email: string, code: string) => ReturnType<Auth['verifyOtp']>;
    resendSignUpCode: (email: string) => ReturnType<Auth['resend']>;
    sendSignInCode: (email: string) => ReturnType<Auth['signInWithOtp']>;
    verifySignInCode: (email: string, code: string) => ReturnType<Auth['verifyOtp']>;
    sendPasswordReset: (email: string) => ReturnType<Auth['resetPasswordForEmail']>;
    verifyPasswordResetCode: (email: string, code: string) => ReturnType<Auth['verifyOtp']>;
    updatePassword: (password: string) => ReturnType<Auth['updateUser']>;
    signInWithGoogle: (idToken: string, nonce: string) => ReturnType<Auth['signInWithIdToken']>;
    signOut: () => ReturnType<Auth['signOut']>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = still loading

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });
        return () => subscription.unsubscribe();
    }, []);

    // tells the public site whether to open the dashboard; written only on the project's own domain
    useEffect(() => {
        if (session === undefined) return;
        const cookie = signedInCookie(window.location.hostname, !!session);
        if (cookie) document.cookie = cookie;
    }, [session]);

    const signIn = (email: string, password: string) =>
        supabase.auth.signInWithPassword({ email, password });

    // a password account, for instances that do not email sign-in codes; with Confirm email on, a code confirms it
    const signUp = (email: string, password: string) =>
        supabase.auth.signUp({ email, password });

    const verifySignUpCode = (email: string, code: string) =>
        supabase.auth.verifyOtp({ email, token: code, type: 'signup' });

    const resendSignUpCode = (email: string) =>
        supabase.auth.resend({ type: 'signup', email });

    // emails a 6-digit code that signs the user in, creating the account the first time an address is used
    const sendSignInCode = (email: string) =>
        supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });

    // a correct code also confirms an address that signed up with a password and never confirmed it
    const verifySignInCode = (email: string, code: string) =>
        supabase.auth.verifyOtp({ email, token: code, type: 'email' });

    // the email's link signs the user in on Settings, where the Password section sets the new password
    const sendPasswordReset = (email: string) =>
        supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/settings` });

    // a correct code signs the user in, so the new password can be saved straight after
    const verifyPasswordResetCode = (email: string, code: string) =>
        supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });

    // also gives an account that only used Google a password for the same user
    const updatePassword = (password: string) => supabase.auth.updateUser({ password });

    // the raw nonce lets supabase confirm the google token came from this sign-in
    const signInWithGoogle = (idToken: string, nonce: string) =>
        supabase.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce });

    const signOut = () => supabase.auth.signOut();

    return (
        <AuthContext.Provider value={{ session, user: session?.user ?? null, signIn, signUp, verifySignUpCode, resendSignUpCode, sendSignInCode, verifySignInCode, sendPasswordReset, verifyPasswordResetCode, updatePassword, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
