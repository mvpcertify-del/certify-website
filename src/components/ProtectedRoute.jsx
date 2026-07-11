import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccessRoute, hasPermission, hasAnyPermission, PERMISSIONS, ROLES } from '../utils/roles';
import { Loader2, ShieldX } from 'lucide-react';
import './ProtectedRoute.css';

/**
 * ProtectedRoute — Auth + RBAC middleware for dashboard routes.
 *
 * Usage:
 *   <ProtectedRoute>                          → requires login only
 *   <ProtectedRoute allowedRoles={[...]}>     → restricts to specific roles
 *   <ProtectedRoute requiredPermission="..."> → requires a specific permission
 *   <ProtectedRoute requiredPermissions={[...]} requireAll={false}> → any permission
 *
 * Redirect behaviour:
 *   - Not authenticated → /login (preserves return URL)
 *   - Authenticated but unauthorized → /unauthorized
 */
export default function ProtectedRoute({
  children,
  allowedRoles,
  requiredPermission,
  requiredPermissions,
  requireAll = false,
}) {
  const { isAuthenticated, user, loading, logout } = useAuth();
  const location = useLocation();

  // A client whose account is explicitly pending/rejected must never reach a
  // dashboard, even if they somehow hold a transient session (e.g. the
  // password-recovery window on a pay-first account that hasn't paid yet).
  // Approval is otherwise enforced only inside login(); this closes that gap
  // at the route layer. null/undefined/'approved' → allowed, so existing
  // clients are unaffected.
  const blockedClient =
    isAuthenticated && user?.role === ROLES.CLIENT &&
    (user?.approval_status === 'pending' || user?.approval_status === 'rejected');

  useEffect(() => {
    if (blockedClient) logout();
  }, [blockedClient, logout]);

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="protected-route__loading">
        <Loader2 size={32} className="protected-route__spinner" />
        <span>Loading your session...</span>
      </div>
    );
  }

  // ---- Not authenticated → redirect to login ----
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // ---- Pending/rejected client → bounced to login (logout fired above) ----
  if (blockedClient) {
    const flag = user?.approval_status === 'rejected' ? 'rejected' : 'pending';
    return <Navigate to={`/login?${flag}=1`} replace />;
  }

  // ---- Role gate ----
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // ---- Single permission gate ----
  if (requiredPermission && !hasPermission(user?.role, requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // ---- Multiple permissions gate ----
  if (requiredPermissions && requiredPermissions.length > 0) {
    const check = requireAll
      ? requiredPermissions.every(p => hasPermission(user?.role, p))
      : requiredPermissions.some(p => hasPermission(user?.role, p));

    if (!check) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // ---- Route-level permission check (from ROUTE_PERMISSIONS map) ----
  if (!canAccessRoute(user?.role, location.pathname)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

/**
 * RequirePermission — inline permission guard for UI elements.
 *
 * Usage:
 *   <RequirePermission permission="manage_companies">
 *     <Button>Add Company</Button>
 *   </RequirePermission>
 *
 *   <RequirePermission permissions={['manage_companies','register_company']} any>
 *     <Button>Add</Button>
 *   </RequirePermission>
 */
export function RequirePermission({
  children,
  permission,
  permissions,
  any = true,
  fallback = null,
}) {
  const { user } = useAuth();

  if (permission) {
    return hasPermission(user?.role, permission) ? children : fallback;
  }

  if (permissions && permissions.length > 0) {
    const check = any
      ? hasAnyPermission(user?.role, permissions)
      : permissions.every(p => hasPermission(user?.role, p));

    return check ? children : fallback;
  }

  return children;
}

/**
 * usePermission — hook for permission checks in component logic.
 *
 * Usage:
 *   const { can, canAny, canAll, isAtLeast } = usePermission();
 *   if (can('manage_companies')) { ... }
 */
export function usePermission() {
  const { user } = useAuth();

  return {
    can: (permission) => hasPermission(user?.role, permission),
    canAny: (permissions) => hasAnyPermission(user?.role, permissions),
    canAll: (permissions) => permissions.every(p => hasPermission(user?.role, p)),
    role: user?.role,
    region: user?.region,
  };
}
