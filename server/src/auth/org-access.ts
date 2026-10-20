import type { AuthOrganizationMembership } from '@aero-judge/shared';

/** Membership id prefix for tenants a platform operator can open without a membership row. */
export const PLATFORM_ORG_ACCESS_PREFIX = 'platform:';

export function isPlatformOrgAccess(membershipId: string): boolean {
  return membershipId.startsWith(PLATFORM_ORG_ACCESS_PREFIX);
}

/**
 * Adds active tenants a platform operator does not already belong to.
 * Real active memberships keep their role. Invited-only rows for those tenants
 * are replaced so the switcher has one entry per organization.
 */
export function mergeAccessibleOrganizations(
  memberships: AuthOrganizationMembership[],
  additional: AuthOrganizationMembership[],
): AuthOrganizationMembership[] {
  const activeIds = new Set(
    memberships.filter((m) => m.status === 'ACTIVE').map((m) => m.organizationId),
  );
  const extras = additional.filter((org) => !activeIds.has(org.organizationId));
  const extraIds = new Set(extras.map((org) => org.organizationId));
  const kept = memberships.filter(
    (membership) => membership.status === 'ACTIVE' || !extraIds.has(membership.organizationId),
  );
  return [...kept, ...extras].sort((a, b) => a.name.localeCompare(b.name));
}
