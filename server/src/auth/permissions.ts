import {
  getPermissionsForOrgRole,
  hasPermission,
  type OrgRole,
  type Permission,
  type Role,
} from '@aero-judge/shared';

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

/** Platform operators who can open every tenant, not only their memberships. */
export function canAdministerAllOrganizations(role: Role): boolean {
  return hasPermission(role, 'platform:organizations');
}

/**
 * Permission bundle used when a platform operator enters a tenant they do not
 * belong to. Scoped to that organization context only.
 */
export function platformOperatorOrgPermissions(): Permission[] {
  return [...getPermissionsForOrgRole('ORGANIZATION_OWNER')];
}
