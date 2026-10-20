import { describe, expect, it } from 'vitest';
import type { AuthOrganizationMembership } from '@aero-judge/shared';
import { mergeAccessibleOrganizations } from '../auth/org-access.js';

function membership(
  partial: Pick<AuthOrganizationMembership, 'id' | 'organizationId' | 'name' | 'shortName' | 'role' | 'status'>,
): AuthOrganizationMembership {
  return {
    slug: partial.shortName.toLowerCase(),
    permissions: [],
    customRoleId: null,
    customRoleName: null,
    ...partial,
  };
}

describe('mergeAccessibleOrganizations', () => {
  it('keeps real memberships and adds tenants the operator does not belong to', () => {
    const memberships = [
      membership({
        id: 'm1',
        organizationId: 'org-mpa',
        name: 'Manali Paragliding Association',
        shortName: 'MPA',
        role: 'ORGANIZATION_OWNER',
        status: 'ACTIVE',
      }),
      membership({
        id: 'm2',
        organizationId: 'org-nepha',
        name: 'Nepal Paragliding & Hanggliding Association',
        shortName: 'NEPHA',
        role: 'ORGANIZATION_OWNER',
        status: 'ACTIVE',
      }),
      membership({
        id: 'm3',
        organizationId: 'org-rtds',
        name: 'Rhenock Tourism Development Society',
        shortName: 'RTDS',
        role: 'ORGANIZATION_OWNER',
        status: 'ACTIVE',
      }),
    ];
    const extra = membership({
      id: 'platform:org-udaypur',
      organizationId: 'org-udaypur',
      name: 'Nepal Paragliding & Hanggliding Association, Udaypur',
      shortName: 'NEPHA Udaypur',
      role: 'ORGANIZATION_OWNER',
      status: 'ACTIVE',
    });

    const merged = mergeAccessibleOrganizations(memberships, [extra]);

    expect(merged.map((org) => org.shortName)).toEqual([
      'MPA',
      'NEPHA',
      'NEPHA Udaypur',
      'RTDS',
    ]);
    expect(merged.find((org) => org.organizationId === 'org-nepha')?.id).toBe('m2');
  });

  it('does not replace an active membership with platform access', () => {
    const owner = membership({
      id: 'm1',
      organizationId: 'org-1',
      name: 'Alpha',
      shortName: 'A',
      role: 'JUDGE',
      status: 'ACTIVE',
    });
    const platform = membership({
      id: 'platform:org-1',
      organizationId: 'org-1',
      name: 'Alpha',
      shortName: 'A',
      role: 'ORGANIZATION_OWNER',
      status: 'ACTIVE',
    });

    const merged = mergeAccessibleOrganizations([owner], [platform]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.role).toBe('JUDGE');
  });

  it('replaces an invited-only row so the tenant stays selectable', () => {
    const invited = membership({
      id: 'm1',
      organizationId: 'org-1',
      name: 'Alpha',
      shortName: 'A',
      role: 'VIEWER',
      status: 'INVITED',
    });
    const platform = membership({
      id: 'platform:org-1',
      organizationId: 'org-1',
      name: 'Alpha',
      shortName: 'A',
      role: 'ORGANIZATION_OWNER',
      status: 'ACTIVE',
    });

    const merged = mergeAccessibleOrganizations([invited], [platform]);
    expect(merged).toEqual([platform]);
  });
});
