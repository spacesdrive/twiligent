import type React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from './StateViews';

export interface ProtectedRouteProps {
    children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { session } = useAuth();
    // the saved session is still being read; say so rather than show a blank page
    if (session === undefined) return <LoadingState label="Checking your sign-in" className="min-h-dvh" />;
    if (!session) return <Navigate to="/login" replace />;
    return children;
}
