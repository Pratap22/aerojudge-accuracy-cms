import {
  requireAuth,
  resolveOrganizationContext,
  requireOrgContext,
  requireCompetitionInOrg,
} from '../../../auth/rbac.js';

/**
 * Shared guard for nested /competitions/:competitionId/* routes.
 * Validates auth → org membership → competition belongs to org.
 */
export const competitionScopedGuards = [
  requireAuth,
  resolveOrganizationContext,
  requireOrgContext,
  requireCompetitionInOrg,
];
