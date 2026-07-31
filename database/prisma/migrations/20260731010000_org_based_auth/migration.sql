-- Organization-based auth: OrgRole, member status, platform roles, membership enrichment

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM (
  'ORGANIZATION_OWNER',
  'CHIEF_JUDGE',
  'MEET_DIRECTOR',
  'SCORER',
  'JUDGE',
  'ANNOUNCER',
  'DISPLAY_OPERATOR',
  'LAUNCH_MARSHAL',
  'GOAL_MARSHAL',
  'REGISTRATION_OFFICER',
  'VIEWER'
);

-- CreateEnum
CREATE TYPE "OrganizationMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'INACTIVE', 'SUSPENDED');

-- AlterEnum Role: platform support roles
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PLATFORM_SUPPORT';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PLATFORM_DEVELOPER';

-- Rebuild OrganizationMember.role from legacy Role to OrgRole
ALTER TABLE "OrganizationMember" ADD COLUMN "role_new" "OrgRole";

UPDATE "OrganizationMember" SET "role_new" = CASE
  WHEN "role"::text = 'SUPER_ADMIN' THEN 'ORGANIZATION_OWNER'::"OrgRole"
  WHEN "role"::text = 'COMPETITION_DIRECTOR' THEN 'MEET_DIRECTOR'::"OrgRole"
  WHEN "role"::text = 'CHIEF_JUDGE' THEN 'CHIEF_JUDGE'::"OrgRole"
  WHEN "role"::text = 'SCOREKEEPER' THEN 'SCORER'::"OrgRole"
  WHEN "role"::text = 'JUDGE' THEN 'JUDGE'::"OrgRole"
  WHEN "role"::text = 'ANNOUNCER' THEN 'ANNOUNCER'::"OrgRole"
  WHEN "role"::text = 'DISPLAY_OPERATOR' THEN 'DISPLAY_OPERATOR'::"OrgRole"
  WHEN "role"::text = 'LAUNCH_MARSHAL' THEN 'LAUNCH_MARSHAL'::"OrgRole"
  WHEN "role"::text = 'GOAL_MARSHAL' THEN 'GOAL_MARSHAL'::"OrgRole"
  ELSE 'VIEWER'::"OrgRole"
END;

ALTER TABLE "OrganizationMember" DROP COLUMN "role";
ALTER TABLE "OrganizationMember" RENAME COLUMN "role_new" TO "role";
ALTER TABLE "OrganizationMember" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "OrganizationMember" ALTER COLUMN "role" SET DEFAULT 'VIEWER'::"OrgRole";

-- Member lifecycle fields
ALTER TABLE "OrganizationMember" ADD COLUMN IF NOT EXISTS "status" "OrganizationMemberStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "OrganizationMember" ADD COLUMN IF NOT EXISTS "invitedById" TEXT;
ALTER TABLE "OrganizationMember" ADD COLUMN IF NOT EXISTS "joinedAt" TIMESTAMP(3);
ALTER TABLE "OrganizationMember" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

UPDATE "OrganizationMember" SET "joinedAt" = "createdAt" WHERE "joinedAt" IS NULL AND "status" = 'ACTIVE';

-- Indexes
CREATE INDEX IF NOT EXISTS "OrganizationMember_status_idx" ON "OrganizationMember"("status");
CREATE INDEX IF NOT EXISTS "OrganizationMember_role_idx" ON "OrganizationMember"("role");

-- FK invitedBy
ALTER TABLE "OrganizationMember"
  ADD CONSTRAINT "OrganizationMember_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed memberships for existing users into default organization (if present)
INSERT INTO "OrganizationMember" (
  "id", "organizationId", "userId", "role", "status", "joinedAt", "createdAt", "updatedAt"
)
SELECT
  'orgmem_' || u.id,
  'org_npha_default_migration',
  u.id,
  CASE u.role::text
    WHEN 'SUPER_ADMIN' THEN 'ORGANIZATION_OWNER'::"OrgRole"
    WHEN 'COMPETITION_DIRECTOR' THEN 'MEET_DIRECTOR'::"OrgRole"
    WHEN 'CHIEF_JUDGE' THEN 'CHIEF_JUDGE'::"OrgRole"
    WHEN 'SCOREKEEPER' THEN 'SCORER'::"OrgRole"
    WHEN 'JUDGE' THEN 'JUDGE'::"OrgRole"
    WHEN 'ANNOUNCER' THEN 'ANNOUNCER'::"OrgRole"
    WHEN 'DISPLAY_OPERATOR' THEN 'DISPLAY_OPERATOR'::"OrgRole"
    WHEN 'LAUNCH_MARSHAL' THEN 'LAUNCH_MARSHAL'::"OrgRole"
    WHEN 'GOAL_MARSHAL' THEN 'GOAL_MARSHAL'::"OrgRole"
    ELSE 'VIEWER'::"OrgRole"
  END,
  'ACTIVE'::"OrganizationMemberStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
WHERE EXISTS (SELECT 1 FROM "Organization" o WHERE o.id = 'org_npha_default_migration')
  AND NOT EXISTS (
    SELECT 1 FROM "OrganizationMember" m
    WHERE m."organizationId" = 'org_npha_default_migration' AND m."userId" = u.id
  );
