import { usePermissions } from '@/hooks/usePermissions';
import { ReactNode } from 'react';

interface PermissionGateProps {
  /** Array of permission keys to check */
  permissions: string[];
  /** If true, user must have ALL permissions. If false, user needs ANY permission. Default: false */
  requireAll?: boolean;
  /** Optional fallback content to show when user lacks permissions */
  fallback?: ReactNode;
  /** Content to render when user has required permissions */
  children: ReactNode;
}

/**
 * PermissionGate component conditionally renders children based on user permissions
 * 
 * @example
 * ```tsx
 * // Show content only if user has markets.manage permission
 * <PermissionGate permissions={['markets.manage']}>
 *   <Button>Create Market</Button>
 * </PermissionGate>
 * 
 * // Show content if user has ANY of the specified permissions
 * <PermissionGate permissions={['bookings.view.self', 'bookings.view.all']}>
 *   <BookingsList />
 * </PermissionGate>
 * 
 * // Show content only if user has ALL specified permissions
 * <PermissionGate permissions={['users.view', 'roles.assign']} requireAll>
 *   <UserRoleEditor />
 * </PermissionGate>
 * 
 * // Show fallback content when user lacks permissions
 * <PermissionGate 
 *   permissions={['users.manage']} 
 *   fallback={<p>You don't have access to this feature</p>}
 * >
 *   <UserManagementPanel />
 * </PermissionGate>
 * ```
 */
export const PermissionGate = ({ 
  permissions, 
  requireAll = false,
  fallback = null,
  children 
}: PermissionGateProps) => {
  const { hasAllPermissions, hasAnyPermission } = usePermissions();
  
  // If no permissions specified, always show children
  if (permissions.length === 0) {
    return <>{children}</>;
  }
  
  const hasAccess = requireAll
    ? hasAllPermissions(permissions)
    : hasAnyPermission(permissions);
  
  return hasAccess ? <>{children}</> : <>{fallback}</>;
};
