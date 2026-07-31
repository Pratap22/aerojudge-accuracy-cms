import { describe, it, expect } from 'vitest';
import {
  createOrganizationSchema,
  updateOrganizationStatusSchema,
  organizationSettingsSchema,
  listOrganizationsQuerySchema,
  hasPermission,
} from '@npha/shared';

describe('organization schemas', () => {
  it('accepts a valid create payload', () => {
    const result = createOrganizationSchema.safeParse({
      name: 'Hang Gliding Federation of India',
      shortName: 'HGFI',
      slug: 'hgfi',
      country: 'India',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.plan).toBe('FREE');
      expect(result.data.defaultRuleProfile).toBe('FAI_2022');
    }
  });

  it('rejects invalid slug', () => {
    const result = createOrganizationSchema.safeParse({
      name: 'Test Org',
      shortName: 'TO',
      slug: 'Invalid Slug!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid hex color', () => {
    const result = createOrganizationSchema.safeParse({
      name: 'Test Org',
      shortName: 'TO',
      slug: 'test-org',
      primaryColor: 'blue',
    });
    expect(result.success).toBe(false);
  });

  it('accepts status transitions', () => {
    expect(updateOrganizationStatusSchema.safeParse({ status: 'ACTIVE' }).success).toBe(true);
    expect(updateOrganizationStatusSchema.safeParse({ status: 'ARCHIVED' }).success).toBe(true);
    expect(updateOrganizationStatusSchema.safeParse({ status: 'DELETED' }).success).toBe(false);
  });

  it('accepts settings JSON blobs', () => {
    const result = organizationSettingsSchema.safeParse({
      competitionDefaultsJson: { maxRounds: 8 },
      printingDefaultsJson: { format: 'A4_PORTRAIT' },
      notificationDefaultsJson: { email: true },
    });
    expect(result.success).toBe(true);
  });

  it('coerces list query pagination', () => {
    const result = listOrganizationsQuerySchema.safeParse({
      page: '2',
      pageSize: '25',
      search: 'npha',
      isActive: 'true',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(25);
      expect(result.data.isActive).toBe(true);
    }
  });
});

describe('organization permissions', () => {
  it('allows super admin to manage organizations', () => {
    expect(hasPermission('SUPER_ADMIN', 'organization:manage')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'organization:read')).toBe(true);
  });

  it('allows directors to read but not manage', () => {
    expect(hasPermission('COMPETITION_DIRECTOR', 'organization:read')).toBe(true);
    expect(hasPermission('COMPETITION_DIRECTOR', 'organization:manage')).toBe(false);
  });

  it('denies judges organization management', () => {
    expect(hasPermission('JUDGE', 'organization:manage')).toBe(false);
    expect(hasPermission('JUDGE', 'organization:read')).toBe(false);
  });
});
