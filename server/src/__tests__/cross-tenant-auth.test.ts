import { describe, it, expect } from 'vitest';
import {
  getPermissionsForOrgRole,
  hasEffectivePermission,
  hasOrgPermission,
  type Permission,
} from '@npha/shared';
import { summarizeAuditDetails } from '../services/audit.service.js';

/**
 * Cross-tenant authorization scenarios (Unit).
 *
 * Models Organization A / User A vs Organization B / User B without a live DB.
 * Service/middleware isolation relies on the same hasEffectivePermission rules
 * and organization-scoped membership resolution documented in AUTH guides.
 */
describe('cross-tenant security matrix', () => {
  const orgAOwnerPerms = getPermissionsForOrgRole('ORGANIZATION_OWNER');
  const orgBViewerPerms = getPermissionsForOrgRole('VIEWER');

  const userAInOrgA = {
    platformRole: 'PUBLIC_USER' as const,
    orgRole: 'ORGANIZATION_OWNER' as const,
    permissions: orgAOwnerPerms,
  };

  const userAInOrgB = {
    platformRole: 'PUBLIC_USER' as const,
    orgRole: 'VIEWER' as const,
    permissions: orgBViewerPerms,
  };

  const userBInOrgB = {
    platformRole: 'PUBLIC_USER' as const,
    orgRole: 'MEET_DIRECTOR' as const,
    permissions: getPermissionsForOrgRole('MEET_DIRECTOR'),
  };

  const sensitive: Permission[] = [
    'competition:create',
    'competition:delete',
    'pilot:manage',
    'score:enter',
    'score:confirm',
    'results:publish',
    'organization:members',
    'audit:view',
  ];

  it('User A owner in Org A has owner permissions in Org A context', () => {
    for (const permission of sensitive) {
      expect(
        hasEffectivePermission({ ...userAInOrgA, permission, allowLegacyGlobalRole: false }),
      ).toBe(hasOrgPermission('ORGANIZATION_OWNER', permission));
    }
  });

  it('User A in Org B with VIEWER cannot manage Org B resources', () => {
    for (const permission of sensitive) {
      expect(
        hasEffectivePermission({ ...userAInOrgB, permission, allowLegacyGlobalRole: false }),
      ).toBe(false);
    }
    expect(
      hasEffectivePermission({
        ...userAInOrgB,
        permission: 'organization:read',
        allowLegacyGlobalRole: false,
      }),
    ).toBe(true);
  });

  it('Org A owner permissions do not apply when evaluated as Org B viewer', () => {
    // Same physical user, different membership context (simulates spoofed header rejected
    // server-side would still load VIEWER for Org B membership only).
    expect(
      hasEffectivePermission({
        platformRole: 'PUBLIC_USER',
        orgRole: 'VIEWER',
        permissions: orgBViewerPerms,
        permission: 'competition:delete',
        allowLegacyGlobalRole: false,
      }),
    ).toBe(false);
    expect(
      hasEffectivePermission({
        platformRole: 'PUBLIC_USER',
        orgRole: 'ORGANIZATION_OWNER',
        permissions: orgAOwnerPerms,
        permission: 'competition:delete',
        allowLegacyGlobalRole: false,
      }),
    ).toBe(true);
  });

  it('User B cannot inherit User A capabilities without Org A membership', () => {
    expect(
      hasEffectivePermission({
        ...userBInOrgB,
        permission: 'competition:delete',
        allowLegacyGlobalRole: false,
      }),
    ).toBe(false);
  });

  it('denies tenant permissions when no org membership context and legacy off', () => {
    expect(
      hasEffectivePermission({
        platformRole: 'COMPETITION_DIRECTOR',
        orgRole: null,
        permissions: null,
        permission: 'competition:create',
        allowLegacyGlobalRole: false,
      }),
    ).toBe(false);
  });

  it('legacy global role still works when allowLegacyGlobalRole is true (transition)', () => {
    expect(
      hasEffectivePermission({
        platformRole: 'COMPETITION_DIRECTOR',
        orgRole: null,
        permissions: null,
        permission: 'competition:create',
        allowLegacyGlobalRole: true,
      }),
    ).toBe(true);
  });

  it('platform SUPER_ADMIN still cannot create competitions without membership', () => {
    expect(
      hasEffectivePermission({
        platformRole: 'SUPER_ADMIN',
        orgRole: null,
        permissions: null,
        permission: 'competition:create',
        allowLegacyGlobalRole: false,
      }),
    ).toBe(false);
  });

  it('audit:view is owner/md/chief only — not viewers or scorers', () => {
    expect(hasOrgPermission('ORGANIZATION_OWNER', 'audit:view')).toBe(true);
    expect(hasOrgPermission('VIEWER', 'audit:view')).toBe(false);
    expect(hasOrgPermission('SCORER', 'audit:view')).toBe(false);
    expect(
      hasEffectivePermission({
        platformRole: 'PUBLIC_USER',
        orgRole: 'VIEWER',
        permissions: getPermissionsForOrgRole('VIEWER'),
        permission: 'audit:view',
        allowLegacyGlobalRole: false,
      }),
    ).toBe(false);
  });
});

describe('audit action naming (competition integrity)', () => {
  it('produces readable SCORE change summaries', () => {
    const details = summarizeAuditDetails({
      action: 'SCORE_ENTER',
      entityType: 'Score',
      entityId: 'scoreid1234567890',
      beforeJson: { score: 7 },
      afterJson: { score: 3 },
    });
    expect(details).toContain('score');
    expect(details).toContain('7');
    expect(details).toContain('3');
  });
});
