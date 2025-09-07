import { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactElement;
  requiredRole: 'vendor' | 'admin';
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, userProfile, loading, profileLoading } = useAuth();

  // Show loading state while checking auth
  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login with next parameter
  if (!user) {
    const currentPath = window.location.pathname;
    return <Navigate to={`/login?next=${currentPath}`} replace />;
  }

  // No profile or wrong role - redirect to appropriate dashboard
  if (!userProfile?.role || userProfile.role !== requiredRole) {
    const redirectPath = userProfile?.role === 'admin' ? '/admin' : '/vendor';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};