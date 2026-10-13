import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Auth = typeof supabase.auth;

export interface AuthContextValue {
    session: Session | null | undefined;
    user: User | null;
    signIn: (email: string, password: string) => ReturnType<Auth['signInWithPassword']>;
    signUp: (email: string, password: string) => ReturnType<Auth['signUp']>;
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

    const signIn = (email: string, password: string) =>
        supabase.auth.signInWithPassword({ email, password });

    const signUp = (email: string, password: string) =>
        supabase.auth.signUp({ email, password });

    // the raw nonce lets supabase confirm the google token came from this sign-in
    const signInWithGoogle = (idToken: string, nonce: string) =>
        supabase.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce });

    const signOut = () => supabase.auth.signOut();

    return (
        <AuthContext.Provider value={{ session, user: session?.user ?? null, signIn, signUp, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
