-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrganizationPlan" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "brandingJson" JSONB,
    "defaultRuleProfile" "RuleSetVersion" NOT NULL DEFAULT 'FAI_2022',
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "plan" "OrganizationPlan" NOT NULL DEFAULT 'FREE',
    "licenseKey" TEXT,
    "featureFlags" JSONB,
    "maxCompetitions" INTEGER NOT NULL DEFAULT 10,
    "maxUsers" INTEGER NOT NULL DEFAULT 25,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "generalJson" JSONB,
    "competitionDefaultsJson" JSONB,
    "printingDefaultsJson" JSONB,
    "displayDefaultsJson" JSONB,
    "certificatesJson" JSONB,
    "reportsJson" JSONB,
    "ruleProfileJson" JSONB,
    "notificationDefaultsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PUBLIC_USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "Organization_isActive_idx" ON "Organization"("isActive");

-- CreateIndex
CREATE INDEX "Organization_name_idx" ON "Organization"("name");

-- CreateIndex
CREATE INDEX "Organization_plan_idx" ON "Organization"("plan");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSettings_organizationId_key" ON "OrganizationSettings"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default organization for existing data (migration-safe fixed id)
INSERT INTO "Organization" (
    "id", "name", "shortName", "slug", "description", "country", "timezone", "currency",
    "primaryColor", "secondaryColor", "accentColor", "defaultRuleProfile", "status", "isActive",
    "plan", "maxCompetitions", "maxUsers", "createdAt", "updatedAt"
) VALUES (
    'org_npha_default_migration',
    'Nepal Paragliding & Hang Gliding Association',
    'NPHA',
    'npha',
    'Default organization created during multi-tenant migration. Sample / early-customer tenant for AeroJudge.',
    'Nepal',
    'Asia/Kathmandu',
    'NPR',
    '#0b1f33',
    '#1e3a5f',
    '#0ea5e9',
    'FAI_2022',
    'ACTIVE',
    true,
    'PROFESSIONAL',
    100,
    100,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

INSERT INTO "OrganizationSettings" (
    "id", "organizationId", "createdAt", "updatedAt"
) VALUES (
    'orgset_npha_default_migration',
    'org_npha_default_migration',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- AlterTable Competition: add organizationId (nullable first for backfill)
ALTER TABLE "Competition" ADD COLUMN "organizationId" TEXT;

UPDATE "Competition" SET "organizationId" = 'org_npha_default_migration' WHERE "organizationId" IS NULL;

ALTER TABLE "Competition" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Competition_organizationId_idx" ON "Competition"("organizationId");

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable RuleProfile: optional organization scope
ALTER TABLE "RuleProfile" ADD COLUMN "organizationId" TEXT;

CREATE INDEX "RuleProfile_organizationId_idx" ON "RuleProfile"("organizationId");

ALTER TABLE "RuleProfile" ADD CONSTRAINT "RuleProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
