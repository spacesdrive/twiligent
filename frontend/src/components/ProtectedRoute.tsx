import type React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export interface ProtectedRouteProps {
    children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { session } = useAuth();
    if (session === undefined) return null; // still loading session
    if (!session) return <Navigate to="/login" replace />;
    return children;
}
