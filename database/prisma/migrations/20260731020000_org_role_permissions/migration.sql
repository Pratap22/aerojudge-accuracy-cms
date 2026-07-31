-- Custom organization roles (permission bundles) + member.customRoleId

CREATE TABLE "OrganizationRole" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "basedOnOrgRole" "OrgRole",
    "isSystemClone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationRole_organizationId_key_key" ON "OrganizationRole"("organizationId", "key");
CREATE INDEX "OrganizationRole_organizationId_idx" ON "OrganizationRole"("organizationId");

ALTER TABLE "OrganizationRole"
  ADD CONSTRAINT "OrganizationRole_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationMember" ADD COLUMN IF NOT EXISTS "customRoleId" TEXT;

CREATE INDEX IF NOT EXISTS "OrganizationMember_customRoleId_idx" ON "OrganizationMember"("customRoleId");

ALTER TABLE "OrganizationMember"
  ADD CONSTRAINT "OrganizationMember_customRoleId_fkey"
  FOREIGN KEY ("customRoleId") REFERENCES "OrganizationRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
