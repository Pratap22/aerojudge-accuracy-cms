import { describe, expect, it } from 'vitest';
import { pickApproverRoleLabel } from '../services/approver-label.js';

describe('pickApproverRoleLabel', () => {
  it('replaces a generic Viewer stamp with the competition title', () => {
    expect(
      pickApproverRoleLabel({
        storedLabel: 'Viewer',
        officialRoles: ['Chief Judge'],
        orgRoleLabel: 'Viewer',
      }),
    ).toBe('Chief Judge');
  });

  it('uses the organization title when no competition official role is set', () => {
    expect(
      pickApproverRoleLabel({
        storedLabel: 'Viewer',
        orgRoleLabel: 'Chief Judge',
      }),
    ).toBe('Chief Judge');
  });

  it('keeps a specific stored approval title', () => {
    expect(
      pickApproverRoleLabel({
        storedLabel: 'Meet Director',
        officialRoles: ['Chief Judge'],
        orgRoleLabel: 'Viewer',
      }),
    ).toBe('Meet Director');
  });

  it('keeps Viewer when that is the only role', () => {
    expect(
      pickApproverRoleLabel({
        storedLabel: 'Viewer',
        orgRoleLabel: 'Viewer',
      }),
    ).toBe('Viewer');
  });
});
