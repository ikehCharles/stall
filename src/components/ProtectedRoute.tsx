import { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

interface ProtectedRouteProps {
  children: ReactElement;
  // New permission-based protection
  requiredPermissions?: string[];
  requireAll?: boolean; // If true, user must have ALL permissions. If false, user needs ANY permission.
  fallbackPath?: string; // Where to redirect if permission check fails
}

export const ProtectedRoute = ({
  children,
  requiredPermissions = [],
  requireAll = false,
}: ProtectedRouteProps) => {
  const { user, userProfile, loading, profileLoading } = useAuth();
  const { roleRedirectCheck } = usePermissions();

  // Show loading state while checking auth
  if (loading || profileLoading || (user && profileLoading) || (user && !userProfile)) {
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

  const { redirectUrl, unauthorized } = roleRedirectCheck(requiredPermissions, requireAll);
  if (redirectUrl) return <Navigate to={`/${redirectUrl}`} replace />;

  if (unauthorized) return <Navigate to="/unauthorized" replace />;


  return children;
};
