import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function resolveMigrationPath(): string {
  const candidates = [
    resolve(process.cwd(), '../database/prisma/migrations/20260731000000_add_organizations/migration.sql'),
    resolve(process.cwd(), 'database/prisma/migrations/20260731000000_add_organizations/migration.sql'),
    resolve(
      process.cwd(),
      'server/../database/prisma/migrations/20260731000000_add_organizations/migration.sql',
    ),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(`Organization migration SQL not found. Tried:\n${candidates.join('\n')}`);
  }
  return found;
}

describe('organization migration SQL', () => {
  const sql = readFileSync(resolveMigrationPath(), 'utf8');

  it('creates Organization table and enums', () => {
    expect(sql).toContain('CREATE TYPE "OrganizationStatus"');
    expect(sql).toContain('CREATE TYPE "OrganizationPlan"');
    expect(sql).toContain('CREATE TABLE "Organization"');
    expect(sql).toContain('CREATE TABLE "OrganizationSettings"');
    expect(sql).toContain('CREATE TABLE "OrganizationMember"');
  });

  it('seeds default NPHA organization for existing data', () => {
    expect(sql).toContain('org_npha_default_migration');
    expect(sql).toContain('Nepal Paragliding & Hang Gliding Association');
    expect(sql).toContain("'npha'");
  });

  it('backfills Competition.organizationId and adds FK', () => {
    expect(sql).toContain('ADD COLUMN "organizationId" TEXT');
    expect(sql).toContain('SET "organizationId" = \'org_npha_default_migration\'');
    expect(sql).toContain('ALTER COLUMN "organizationId" SET NOT NULL');
    expect(sql).toContain('Competition_organizationId_fkey');
    expect(sql).toContain('ON DELETE RESTRICT');
  });

  it('indexes organization lookups', () => {
    expect(sql).toContain('Organization_slug_idx');
    expect(sql).toContain('Competition_organizationId_idx');
  });
});
