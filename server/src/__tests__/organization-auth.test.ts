import { describe, it, expect } from 'vitest';
import {
  hasEffectivePermission,
  hasOrgPermission,
  isPlatformRole,
  mapLegacyRoleToOrgRole,
  hasPermission,
} from '@npha/shared';

describe('organization-based authorization', () => {
  it('treats SUPER_ADMIN as a platform role', () => {
    expect(isPlatformRole('SUPER_ADMIN')).toBe(true);
    expect(isPlatformRole('PLATFORM_SUPPORT')).toBe(true);
    expect(isPlatformRole('COMPETITION_DIRECTOR')).toBe(false);
  });

  it('does not grant org competition access from platform role alone', () => {
    expect(
      hasEffectivePermission({
        platformRole: 'SUPER_ADMIN',
        orgRole: null,
        permission: 'competition:create',
      }),
    ).toBe(false);
  });

  it('grants platform organization create to SUPER_ADMIN', () => {
    expect(
      hasEffectivePermission({
        platformRole: 'SUPER_ADMIN',
        orgRole: null,
        permission: 'platform:organizations',
      }),
    ).toBe(true);
  });

  it('grants meet director competition create via org role', () => {
    expect(hasOrgPermission('MEET_DIRECTOR', 'competition:create')).toBe(true);
    expect(
      hasEffectivePermission({
        platformRole: 'PUBLIC_USER',
        orgRole: 'MEET_DIRECTOR',
        permission: 'competition:create',
      }),
    ).toBe(true);
  });

  it('denies viewer competition create', () => {
    expect(hasOrgPermission('VIEWER', 'competition:create')).toBe(false);
  });

  it('maps legacy roles to org roles', () => {
    expect(mapLegacyRoleToOrgRole('COMPETITION_DIRECTOR')).toBe('MEET_DIRECTOR');
    expect(mapLegacyRoleToOrgRole('SCOREKEEPER')).toBe('SCORER');
    expect(mapLegacyRoleToOrgRole('SUPER_ADMIN')).toBe('ORGANIZATION_OWNER');
  });

  it('allows organization owner to manage members', () => {
    expect(hasOrgPermission('ORGANIZATION_OWNER', 'organization:members')).toBe(true);
    expect(hasOrgPermission('JUDGE', 'organization:members')).toBe(false);
  });

  it('uses explicit permission bundles over role name', () => {
    expect(
      hasEffectivePermission({
        platformRole: 'PUBLIC_USER',
        orgRole: 'VIEWER',
        permissions: ['competition:create', 'score:approve_chief'],
        permission: 'competition:create',
      }),
    ).toBe(true);
    expect(
      hasEffectivePermission({
        platformRole: 'PUBLIC_USER',
        orgRole: 'VIEWER',
        permissions: ['competition:create'],
        permission: 'organization:manage',
      }),
    ).toBe(false);
  });

  it('chief judge bundle includes score approval without hardcoding role checks', () => {
    expect(hasOrgPermission('CHIEF_JUDGE', 'score:approve_chief')).toBe(true);
    expect(hasOrgPermission('MEET_DIRECTOR', 'score:approve_chief')).toBe(true);
    expect(hasOrgPermission('CHIEF_JUDGE', 'competition:delete')).toBe(false);
  });

  it('keeps legacy hasPermission for transition', () => {
    expect(hasPermission('JUDGE', 'score:enter')).toBe(true);
  });

  it('disables legacy global role matrix when allowLegacyGlobalRole is false', () => {
    expect(
      hasEffectivePermission({
        platformRole: 'JUDGE',
        orgRole: null,
        permission: 'score:enter',
        allowLegacyGlobalRole: false,
      }),
    ).toBe(false);
  });

  it('does not let owner bundle leak when only viewer permissions are resolved', () => {
    expect(
      hasEffectivePermission({
        platformRole: 'PUBLIC_USER',
        orgRole: 'VIEWER',
        permissions: ['organization:read'],
        permission: 'organization:manage',
        allowLegacyGlobalRole: false,
      }),
    ).toBe(false);
  });
});
