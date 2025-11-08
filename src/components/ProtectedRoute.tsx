import { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

interface ProtectedRouteProps {
  children: ReactElement;
  // Legacy role-based protection (deprecated, use requiredPermissions instead)
  requiredRole?: 'vendor' | 'admin';
  // New permission-based protection
  requiredPermissions?: string[];
  requireAll?: boolean; // If true, user must have ALL permissions. If false, user needs ANY permission.
  fallbackPath?: string; // Where to redirect if permission check fails
}

export const ProtectedRoute = ({ 
  children, 
  requiredRole,
  requiredPermissions = [],
  requireAll = false,
  fallbackPath
}: ProtectedRouteProps) => {
  const { user, userProfile, loading, profileLoading } = useAuth();
  const { hasPermission, hasAllPermissions, hasAnyPermission, roleKey } = usePermissions();

  // Show loading state while checking auth
  if (loading || profileLoading || (user && profileLoading)) {
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

  // Check permissions if specified (new permission-based system)
  if (requiredPermissions.length > 0) {
    const hasAccess = requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);
    
    if (!hasAccess) {
      // Redirect to appropriate dashboard based on role
      const defaultPath = roleKey === 'admin' 
        ? '/admin' 
        : '/vendor';
      return <Navigate to={fallbackPath || defaultPath} replace />;
    }
  }
  
  // Legacy role-based check (for backward compatibility)
  if (requiredRole && (!userProfile?.role || userProfile.role !== requiredRole)) {
    const redirectPath = userProfile?.role === 'admin' ? '/admin' : '/vendor';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};