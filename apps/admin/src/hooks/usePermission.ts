import { useMemo } from 'react';
import {
  hasEffectivePermission,
  type Permission,
} from '@npha/shared';
import { useAuth } from '../lib/auth';

/** True if the signed-in user has the permission in the active org context. */
export function usePermission(permission: Permission): boolean {
  const { user } = useAuth();
  return useMemo(() => {
    if (!user) return false;
    return hasEffectivePermission({
      platformRole: user.role,
      orgRole: user.orgRole,
      permissions: user.permissions,
      permission,
    });
  }, [user, permission]);
}

/** True if the user has any of the listed permissions. */
export function useAnyPermission(permissions: readonly Permission[]): boolean {
  const { user } = useAuth();
  return useMemo(() => {
    if (!user) return false;
    return permissions.some((permission) =>
      hasEffectivePermission({
        platformRole: user.role,
        orgRole: user.orgRole,
        permissions: user.permissions,
        permission,
      }),
    );
  }, [user, permissions]);
}

export function checkPermission(
  user: {
    role: Parameters<typeof hasEffectivePermission>[0]['platformRole'];
    orgRole?: Parameters<typeof hasEffectivePermission>[0]['orgRole'];
    permissions?: Parameters<typeof hasEffectivePermission>[0]['permissions'];
  } | null,
  permission: Permission,
): boolean {
  if (!user) return false;
  return hasEffectivePermission({
    platformRole: user.role,
    orgRole: user.orgRole,
    permissions: user.permissions,
    permission,
  });
}
