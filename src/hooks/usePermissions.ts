import { useAuth } from '@/contexts/AuthContext';
import { Permission } from '@/lib/permissions';

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
    return keys.some(key => userProfile.permissions.includes(key));
  };
  
  /**
   * Check if user has ALL of the given permissions
   */
  const hasAllPermissions = (keys: string[]): boolean => {
    if (!userProfile?.permissions || keys.length === 0) return false;
    return keys.every(key => userProfile.permissions.includes(key));
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
    ...getRoleInfo(),
  };
};
