import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [session, setSession] = useState(undefined); // undefined = still loading

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });
        return () => subscription.unsubscribe();
    }, []);

    const signIn = (email, password) =>
        supabase.auth.signInWithPassword({ email, password });

    const signUp = (email, password) =>
        supabase.auth.signUp({ email, password });

    // the raw nonce lets supabase confirm the google token was issued for this sign-in
    const signInWithGoogle = (idToken, nonce) =>
        supabase.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce });

    const signOut = () => supabase.auth.signOut();

    return (
        <AuthContext.Provider value={{ session, user: session?.user ?? null, signIn, signUp, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
