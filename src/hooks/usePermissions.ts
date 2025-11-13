import { useAuth } from "@/contexts/AuthContext";
import { PERMISSIONS, PERMISSION_ROUTES, Permission } from "@/lib/permissions";
import { Navigate } from "react-router-dom";

/**
 * Hook to check user permissions in the RBAC system
 *
 * @example
 * ```tsx
 * const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();
 *
 * if (hasPermission('markets.manage')) {
 *   // User can manage markets
 * }
 *
 * if (hasAnyPermission(['bookings.view.self', 'bookings.view.all'])) {
 *   // User can view at least some bookings
 * }
 * ```
 */
export const usePermissions = () => {
  const { userProfile } = useAuth();

  /**
   * Check if user has a specific permission
   */
  const hasPermission = (key: string): boolean => {
    return userProfile?.permissions?.includes(key) ?? false;
  };

  /**
   * Check if user has ANY of the given permissions
   */
  const hasAnyPermission = (keys: string[]): boolean => {
    if (!userProfile?.permissions || keys.length === 0) return false;
    return keys.some((key) => userProfile.permissions.includes(key));
  };

  /**
   * Check if user has ALL of the given permissions
   */
  const hasAllPermissions = (keys: string[]): boolean => {
    if (!userProfile?.permissions || keys.length === 0) return false;
    return keys.every((key) => userProfile.permissions.includes(key));
  };

  const roleRedirectCheck = (
    requiredPermissions: string[],
    requireAll = false
  ) => {

    const res = { redirectUrl: "", unauthorized: false };
    const firstSegment = location.pathname.split("/")[1];

    let count = 0;
    userProfile.permissions.forEach((perm) => {
      if (PERMISSION_ROUTES[perm]) {
        res.redirectUrl = PERMISSION_ROUTES[perm];
        count++;
      }
    });

    // if user has all permissions, redirect to admin
    if (count === Object.keys(PERMISSION_ROUTES).length) {
      res.redirectUrl = PERMISSION_ROUTES[PERMISSIONS.USERS.VIEW_SELF];
    }

    // if the current path is the first segment of the redirect url, remove it
    if (res.redirectUrl === firstSegment) {
      res.redirectUrl = "";
    }

    const hasAccess = requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);
    if (!hasAccess) {
      res.unauthorized = true;
      return res;
    }

    return res;
  };

  /**
   * Get user's role information
   */
  const getRoleInfo = () => ({
    roleKey: userProfile?.role_key || null,
    roleName: userProfile?.role_name || null,
    // Legacy role field for backward compatibility
    role: userProfile?.role || null,
  });

  return {
    permissions: userProfile?.permissions || [],
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    roleRedirectCheck,
    ...getRoleInfo(),
  };
};
