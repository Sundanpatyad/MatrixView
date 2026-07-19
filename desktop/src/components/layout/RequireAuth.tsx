import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';

export function RequireAuth() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-ink-500">
        Restoring session…
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}
