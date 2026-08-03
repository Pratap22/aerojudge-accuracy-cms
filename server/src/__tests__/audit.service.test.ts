import { describe, expect, it } from 'vitest';
import { hasOrgPermission } from '@npha/shared';
import { summarizeAuditDetails } from '../services/audit.service.js';

describe('summarizeAuditDetails', () => {
  it('summarizes status change from before/after', () => {
    const details = summarizeAuditDetails({
      action: 'UPDATE',
      entityType: 'Pilot',
      entityId: 'clkabcdefghijklmnop',
      beforeJson: { status: 'REGISTERED' },
      afterJson: { status: 'CONFIRMED' },
    });
    expect(details).toContain('status');
    expect(details).toContain('REGISTERED');
    expect(details).toContain('CONFIRMED');
  });

  it('handles missing entityId without throwing', () => {
    const details = summarizeAuditDetails({
      action: 'CREATE',
      entityType: 'Competition',
      entityId: null,
      afterJson: { name: 'Demo Meet' },
    });
    expect(details).toContain('CREATE');
    expect(details).toContain('Competition');
  });
});

describe('audit:view permission (authorization matrix)', () => {
  it('is granted to Owner, Meet Director, Chief Judge only among core ops roles', () => {
    expect(hasOrgPermission('ORGANIZATION_OWNER', 'audit:view')).toBe(true);
    expect(hasOrgPermission('MEET_DIRECTOR', 'audit:view')).toBe(true);
    expect(hasOrgPermission('CHIEF_JUDGE', 'audit:view')).toBe(true);
    expect(hasOrgPermission('SCORER', 'audit:view')).toBe(false);
    expect(hasOrgPermission('JUDGE', 'audit:view')).toBe(false);
    expect(hasOrgPermission('VIEWER', 'audit:view')).toBe(false);
  });
});
