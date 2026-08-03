-- Person identity + competition participation
-- Additive only: existing Pilot / Score / Team / User PKs unchanged.

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PRIVATE', 'ORGANIZATIONS_ONLY', 'PUBLIC');
CREATE TYPE "PersonStatus" AS ENUM ('ACTIVE', 'MERGED', 'ARCHIVED');
CREATE TYPE "CompetitionParticipationStatus" AS ENUM ('INVITED', 'REGISTERED', 'CONFIRMED', 'ACTIVE', 'WITHDRAWN', 'DECLINED');
CREATE TYPE "CompetitionRole" AS ENUM ('PILOT', 'CHIEF_JUDGE', 'TARGET_JUDGE', 'JUDGE', 'MEET_DIRECTOR', 'SCORER', 'ANNOUNCER', 'DISPLAY_OPERATOR', 'LAUNCH_MARSHAL', 'GOAL_MARSHAL', 'REGISTRATION_OFFICER', 'SAFETY_DIRECTOR', 'TECHNICAL_DELEGATE', 'VIEWER', 'OTHER');
CREATE TYPE "ProfileClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable Person
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "aeroJudgeId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "preferredName" TEXT,
    "displayName" TEXT,
    "gender" "Gender" NOT NULL DEFAULT 'MALE',
    "dateOfBirth" TIMESTAMP(3),
    "nationalityCountryId" TEXT,
    "photoUrl" TEXT,
    "civlId" TEXT,
    "faiLicenseNumber" TEXT,
    "faiLicenseExpiry" TIMESTAMP(3),
    "email" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "phone" TEXT,
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'PRIVATE',
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Person_aeroJudgeId_key" ON "Person"("aeroJudgeId");
CREATE INDEX "Person_civlId_idx" ON "Person"("civlId");
CREATE INDEX "Person_faiLicenseNumber_idx" ON "Person"("faiLicenseNumber");
CREATE INDEX "Person_lastName_firstName_idx" ON "Person"("lastName", "firstName");
CREATE INDEX "Person_nationalityCountryId_idx" ON "Person"("nationalityCountryId");
CREATE INDEX "Person_email_idx" ON "Person"("email");
CREATE INDEX "Person_status_idx" ON "Person"("status");
CREATE INDEX "Person_visibility_idx" ON "Person"("visibility");
-- Unique CIVL for active persons only
CREATE UNIQUE INDEX "Person_civlId_active_key" ON "Person"("civlId") WHERE "civlId" IS NOT NULL AND "status" = 'ACTIVE';

ALTER TABLE "Person" ADD CONSTRAINT "Person_nationalityCountryId_fkey" FOREIGN KEY ("nationalityCountryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Person" ADD CONSTRAINT "Person_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CompetitionParticipant
CREATE TABLE "CompetitionParticipant" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" "CompetitionParticipationStatus" NOT NULL DEFAULT 'REGISTERED',
    "registrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompetitionParticipant_competitionId_personId_key" ON "CompetitionParticipant"("competitionId", "personId");
CREATE INDEX "CompetitionParticipant_competitionId_idx" ON "CompetitionParticipant"("competitionId");
CREATE INDEX "CompetitionParticipant_personId_idx" ON "CompetitionParticipant"("personId");
CREATE INDEX "CompetitionParticipant_status_idx" ON "CompetitionParticipant"("status");

ALTER TABLE "CompetitionParticipant" ADD CONSTRAINT "CompetitionParticipant_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetitionParticipant" ADD CONSTRAINT "CompetitionParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CompetitionParticipantRole
CREATE TABLE "CompetitionParticipantRole" (
    "id" TEXT NOT NULL,
    "competitionParticipantId" TEXT NOT NULL,
    "role" "CompetitionRole" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionParticipantRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompetitionParticipantRole_competitionParticipantId_role_key" ON "CompetitionParticipantRole"("competitionParticipantId", "role");
CREATE INDEX "CompetitionParticipantRole_role_idx" ON "CompetitionParticipantRole"("role");

ALTER TABLE "CompetitionParticipantRole" ADD CONSTRAINT "CompetitionParticipantRole_competitionParticipantId_fkey" FOREIGN KEY ("competitionParticipantId") REFERENCES "CompetitionParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ProfileClaimRequest
CREATE TABLE "ProfileClaimRequest" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ProfileClaimStatus" NOT NULL DEFAULT 'PENDING',
    "verificationMethod" TEXT,
    "verificationNotes" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileClaimRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProfileClaimRequest_personId_idx" ON "ProfileClaimRequest"("personId");
CREATE INDEX "ProfileClaimRequest_userId_idx" ON "ProfileClaimRequest"("userId");
CREATE INDEX "ProfileClaimRequest_status_idx" ON "ProfileClaimRequest"("status");

ALTER TABLE "ProfileClaimRequest" ADD CONSTRAINT "ProfileClaimRequest_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileClaimRequest" ADD CONSTRAINT "ProfileClaimRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PersonMergeLog
CREATE TABLE "PersonMergeLog" (
    "id" TEXT NOT NULL,
    "canonicalPersonId" TEXT NOT NULL,
    "duplicatePersonId" TEXT NOT NULL,
    "performedByUserId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonMergeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PersonMergeLog_canonicalPersonId_idx" ON "PersonMergeLog"("canonicalPersonId");
CREATE INDEX "PersonMergeLog_duplicatePersonId_idx" ON "PersonMergeLog"("duplicatePersonId");
CREATE INDEX "PersonMergeLog_createdAt_idx" ON "PersonMergeLog"("createdAt");

ALTER TABLE "PersonMergeLog" ADD CONSTRAINT "PersonMergeLog_canonicalPersonId_fkey" FOREIGN KEY ("canonicalPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PersonMergeLog" ADD CONSTRAINT "PersonMergeLog_duplicatePersonId_fkey" FOREIGN KEY ("duplicatePersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PersonMergeLog" ADD CONSTRAINT "PersonMergeLog_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- User.personId
ALTER TABLE "User" ADD COLUMN "personId" TEXT;
CREATE UNIQUE INDEX "User_personId_key" ON "User"("personId");
ALTER TABLE "User" ADD CONSTRAINT "User_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Pilot person + participant links
ALTER TABLE "Pilot" ADD COLUMN "personId" TEXT;
ALTER TABLE "Pilot" ADD COLUMN "competitionParticipantId" TEXT;
CREATE UNIQUE INDEX "Pilot_competitionParticipantId_key" ON "Pilot"("competitionParticipantId");
CREATE INDEX "Pilot_personId_idx" ON "Pilot"("personId");
CREATE INDEX "Pilot_civlId_idx" ON "Pilot"("civlId");
ALTER TABLE "Pilot" ADD CONSTRAINT "Pilot_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Pilot" ADD CONSTRAINT "Pilot_competitionParticipantId_fkey" FOREIGN KEY ("competitionParticipantId") REFERENCES "CompetitionParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Official person + participant links
ALTER TABLE "CompetitionOfficial" ADD COLUMN "personId" TEXT;
ALTER TABLE "CompetitionOfficial" ADD COLUMN "competitionParticipantId" TEXT;
ALTER TABLE "CompetitionOfficial" ADD COLUMN "competitionRole" "CompetitionRole";
CREATE INDEX "CompetitionOfficial_personId_idx" ON "CompetitionOfficial"("personId");
CREATE INDEX "CompetitionOfficial_competitionParticipantId_idx" ON "CompetitionOfficial"("competitionParticipantId");
ALTER TABLE "CompetitionOfficial" ADD CONSTRAINT "CompetitionOfficial_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompetitionOfficial" ADD CONSTRAINT "CompetitionOfficial_competitionParticipantId_fkey" FOREIGN KEY ("competitionParticipantId") REFERENCES "CompetitionParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Data backfill ───

-- Helper: generate stable AJ ids from cuid-ish using md5 of source key (truncated)
-- Persons from Users
INSERT INTO "Person" (
  "id", "aeroJudgeId", "firstName", "lastName", "gender", "email", "phone", "photoUrl", "status", "visibility", "createdAt", "updatedAt"
)
SELECT
  'p_u_' || u."id",
  'AJ-' || UPPER(SUBSTRING(MD5('user:' || u."id") FROM 1 FOR 6)),
  u."firstName",
  u."lastName",
  'MALE'::"Gender",
  u."email",
  u."phone",
  u."avatarUrl",
  'ACTIVE'::"PersonStatus",
  'PRIVATE'::"ProfileVisibility",
  u."createdAt",
  u."updatedAt"
FROM "User" u
WHERE u."personId" IS NULL;

UPDATE "User" u
SET "personId" = 'p_u_' || u."id"
WHERE u."personId" IS NULL
  AND EXISTS (SELECT 1 FROM "Person" p WHERE p."id" = 'p_u_' || u."id");

-- Persons from distinct non-empty CIVL ids on pilots (one person per civl)
INSERT INTO "Person" (
  "id", "aeroJudgeId", "firstName", "lastName", "gender", "dateOfBirth", "nationalityCountryId",
  "photoUrl", "civlId", "faiLicenseNumber", "status", "visibility", "createdAt", "updatedAt"
)
SELECT DISTINCT ON (p."civlId")
  'p_c_' || MD5(p."civlId"),
  'AJ-' || UPPER(SUBSTRING(MD5('civl:' || p."civlId") FROM 1 FOR 6)),
  p."firstName",
  p."lastName",
  p."gender",
  p."dateOfBirth",
  p."countryId",
  p."photoUrl",
  p."civlId",
  p."faiLicense",
  'ACTIVE'::"PersonStatus",
  'PRIVATE'::"ProfileVisibility",
  p."createdAt",
  p."updatedAt"
FROM "Pilot" p
WHERE p."civlId" IS NOT NULL
  AND TRIM(p."civlId") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "Person" existing
    WHERE existing."civlId" = p."civlId" AND existing."status" = 'ACTIVE'
  )
ORDER BY p."civlId", p."createdAt" ASC;

-- Persons for pilots without CIVL (one person per pilot — no name-only merge)
INSERT INTO "Person" (
  "id", "aeroJudgeId", "firstName", "lastName", "gender", "dateOfBirth", "nationalityCountryId",
  "photoUrl", "civlId", "faiLicenseNumber", "status", "visibility", "createdAt", "updatedAt"
)
SELECT
  'p_p_' || p."id",
  'AJ-' || UPPER(SUBSTRING(MD5('pilot:' || p."id") FROM 1 FOR 6)),
  p."firstName",
  p."lastName",
  p."gender",
  p."dateOfBirth",
  p."countryId",
  p."photoUrl",
  NULL,
  p."faiLicense",
  'ACTIVE'::"PersonStatus",
  'PRIVATE'::"ProfileVisibility",
  p."createdAt",
  p."updatedAt"
FROM "Pilot" p
WHERE p."personId" IS NULL
  AND (p."civlId" IS NULL OR TRIM(p."civlId") = '');

-- Link pilots with CIVL to person
UPDATE "Pilot" p
SET "personId" = pr."id"
FROM "Person" pr
WHERE p."personId" IS NULL
  AND p."civlId" IS NOT NULL
  AND TRIM(p."civlId") <> ''
  AND pr."civlId" = p."civlId"
  AND pr."status" = 'ACTIVE';

-- Link pilots without CIVL
UPDATE "Pilot" p
SET "personId" = 'p_p_' || p."id"
WHERE p."personId" IS NULL
  AND (p."civlId" IS NULL OR TRIM(p."civlId") = '')
  AND EXISTS (SELECT 1 FROM "Person" pr WHERE pr."id" = 'p_p_' || p."id");

-- Competition participants + PILOT role for each pilot
INSERT INTO "CompetitionParticipant" (
  "id", "competitionId", "personId", "status", "registrationDate", "createdAt", "updatedAt"
)
SELECT
  'cp_p_' || p."id",
  p."competitionId",
  p."personId",
  CASE
    WHEN p."status"::text IN ('ACTIVE', 'CHECKED_IN', 'CONFIRMED') THEN 'ACTIVE'::"CompetitionParticipationStatus"
    WHEN p."status"::text = 'WITHDRAWN' THEN 'WITHDRAWN'::"CompetitionParticipationStatus"
    ELSE 'REGISTERED'::"CompetitionParticipationStatus"
  END,
  p."createdAt",
  p."createdAt",
  p."updatedAt"
FROM "Pilot" p
WHERE p."personId" IS NOT NULL
ON CONFLICT ("competitionId", "personId") DO NOTHING;

-- For ON CONFLICT we need unique constraint name - we have unique index on (competitionId, personId)
-- PostgreSQL ON CONFLICT needs constraint - unique index works with columns
-- Fix: use DO NOTHING with those columns

UPDATE "Pilot" p
SET "competitionParticipantId" = cp."id"
FROM "CompetitionParticipant" cp
WHERE p."personId" IS NOT NULL
  AND cp."competitionId" = p."competitionId"
  AND cp."personId" = p."personId"
  AND p."competitionParticipantId" IS NULL;

INSERT INTO "CompetitionParticipantRole" ("id", "competitionParticipantId", "role", "createdAt")
SELECT
  'cpr_p_' || p."id",
  p."competitionParticipantId",
  'PILOT'::"CompetitionRole",
  p."createdAt"
FROM "Pilot" p
WHERE p."competitionParticipantId" IS NOT NULL
ON CONFLICT ("competitionParticipantId", "role") DO NOTHING;

-- Officials → Person per row (safe, no name merge)
INSERT INTO "Person" (
  "id", "aeroJudgeId", "firstName", "lastName", "gender", "email", "phone", "photoUrl", "status", "visibility", "createdAt", "updatedAt"
)
SELECT
  'p_o_' || o."id",
  'AJ-' || UPPER(SUBSTRING(MD5('official:' || o."id") FROM 1 FOR 6)),
  CASE
    WHEN POSITION(' ' IN TRIM(o."name")) > 0 THEN SPLIT_PART(TRIM(o."name"), ' ', 1)
    ELSE TRIM(o."name")
  END,
  CASE
    WHEN POSITION(' ' IN TRIM(o."name")) > 0 THEN TRIM(SUBSTRING(TRIM(o."name") FROM POSITION(' ' IN TRIM(o."name")) + 1))
    ELSE ''
  END,
  'MALE'::"Gender",
  o."email",
  o."phone",
  o."imageUrl",
  'ACTIVE'::"PersonStatus",
  'PRIVATE'::"ProfileVisibility",
  o."createdAt",
  o."updatedAt"
FROM "CompetitionOfficial" o
WHERE o."personId" IS NULL;

UPDATE "CompetitionOfficial" o
SET "personId" = 'p_o_' || o."id"
WHERE o."personId" IS NULL;

-- Map official display role → CompetitionRole
UPDATE "CompetitionOfficial" o
SET "competitionRole" = CASE
  WHEN LOWER(o."role") LIKE '%chief%judge%' THEN 'CHIEF_JUDGE'::"CompetitionRole"
  WHEN LOWER(o."role") LIKE '%target%judge%' THEN 'TARGET_JUDGE'::"CompetitionRole"
  WHEN LOWER(o."role") LIKE '%meet%director%' OR LOWER(o."role") LIKE '%event%director%' THEN 'MEET_DIRECTOR'::"CompetitionRole"
  WHEN LOWER(o."role") LIKE '%score%' THEN 'SCORER'::"CompetitionRole"
  WHEN LOWER(o."role") LIKE '%announce%' THEN 'ANNOUNCER'::"CompetitionRole"
  WHEN LOWER(o."role") LIKE '%display%' THEN 'DISPLAY_OPERATOR'::"CompetitionRole"
  WHEN LOWER(o."role") LIKE '%launch%' THEN 'LAUNCH_MARSHAL'::"CompetitionRole"
  WHEN LOWER(o."role") LIKE '%goal%' THEN 'GOAL_MARSHAL'::"CompetitionRole"
  WHEN LOWER(o."role") LIKE '%registration%' THEN 'REGISTRATION_OFFICER'::"CompetitionRole"
  WHEN LOWER(o."role") LIKE '%safety%' THEN 'SAFETY_DIRECTOR'::"CompetitionRole"
  WHEN LOWER(o."role") LIKE '%technical%' THEN 'TECHNICAL_DELEGATE'::"CompetitionRole"
  WHEN LOWER(o."role") LIKE '%judge%' THEN 'JUDGE'::"CompetitionRole"
  ELSE 'OTHER'::"CompetitionRole"
END
WHERE o."competitionRole" IS NULL;

-- Participants for officials (may already exist if same person was pilot; officials are 1-person-per-row so new)
INSERT INTO "CompetitionParticipant" (
  "id", "competitionId", "personId", "status", "registrationDate", "createdAt", "updatedAt"
)
SELECT
  'cp_o_' || o."id",
  o."competitionId",
  o."personId",
  'ACTIVE'::"CompetitionParticipationStatus",
  o."createdAt",
  o."createdAt",
  o."updatedAt"
FROM "CompetitionOfficial" o
WHERE o."personId" IS NOT NULL
ON CONFLICT ("competitionId", "personId") DO NOTHING;

UPDATE "CompetitionOfficial" o
SET "competitionParticipantId" = cp."id"
FROM "CompetitionParticipant" cp
WHERE o."personId" IS NOT NULL
  AND cp."competitionId" = o."competitionId"
  AND cp."personId" = o."personId"
  AND o."competitionParticipantId" IS NULL;

INSERT INTO "CompetitionParticipantRole" ("id", "competitionParticipantId", "role", "createdAt")
SELECT
  'cpr_o_' || o."id",
  o."competitionParticipantId",
  COALESCE(o."competitionRole", 'OTHER'::"CompetitionRole"),
  o."createdAt"
FROM "CompetitionOfficial" o
WHERE o."competitionParticipantId" IS NOT NULL
ON CONFLICT ("competitionParticipantId", "role") DO NOTHING;

-- Safety: empty lastName from single-token official names
UPDATE "Person" SET "lastName" = '-' WHERE "lastName" = '' OR "lastName" IS NULL;
