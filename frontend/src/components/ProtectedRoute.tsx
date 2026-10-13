import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
    const { session } = useAuth();
    if (session === undefined) return null; // still loading session
    if (!session) return <Navigate to="/login" replace />;
    return children;
}
