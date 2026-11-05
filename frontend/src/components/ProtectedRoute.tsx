import type React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signInPathFor } from '../lib/signInPage';
import { LoadingState } from './StateViews';

export interface ProtectedRouteProps {
    children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { session } = useAuth();
    const location = useLocation();
    // the saved session is still being read; say so rather than show a blank page
    if (session === undefined) return <LoadingState label="Checking your sign-in" className="min-h-dvh" />;
    // the hash is left behind: it can carry a one-time code that belongs to the page, not to the sign-in
    if (!session) return <Navigate to={signInPathFor(location.pathname + location.search)} replace />;
    return children;
}
