import { getPermissionsForOrgRole, type OrgRole, type Permission } from '@npha/shared';

/**
 * Resolves the effective permission list for a membership.
 * Custom roles win over built-in OrgRole bundles.
 */
export function resolveMembershipPermissions(input: {
  role: OrgRole;
  customRole?: { permissions: unknown } | null;
}): Permission[] {
  if (input.customRole?.permissions != null) {
    const raw = input.customRole.permissions;
    if (Array.isArray(raw)) {
      return raw.filter((p): p is Permission => typeof p === 'string') as Permission[];
    }
  }
  return [...getPermissionsForOrgRole(input.role)];
}
