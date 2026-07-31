import type {
  CreateOrganizationInput,
  ListOrganizationsQuery,
  OrganizationSettingsInput,
  UpdateOrganizationInput,
  UpdateOrganizationStatusInput,
} from '@npha/shared';

/** Default organization id used by the multi-tenant data migration. */
export const DEFAULT_ORGANIZATION_ID = 'org_npha_default_migration';

export const DEFAULT_ORGANIZATION_SLUG = 'npha';

export type { CreateOrganizationInput, ListOrganizationsQuery, OrganizationSettingsInput, UpdateOrganizationInput, UpdateOrganizationStatusInput };

export interface OrganizationListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
