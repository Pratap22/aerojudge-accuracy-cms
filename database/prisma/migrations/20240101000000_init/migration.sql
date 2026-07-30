-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'COMPETITION_DIRECTOR', 'CHIEF_JUDGE', 'JUDGE', 'SCOREKEEPER', 'LAUNCH_MARSHAL', 'GOAL_MARSHAL', 'ANNOUNCER', 'DISPLAY_OPERATOR', 'PUBLIC_USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CompetitionStatus" AS ENUM ('DRAFT', 'REGISTRATION', 'PRACTICE', 'OFFICIAL', 'PAUSED', 'COMPLETED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RuleSetVersion" AS ENUM ('FAI_2022', 'FAI_FUTURE', 'NPHA_LOCAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "PilotStatus" AS ENUM ('REGISTERED', 'CONFIRMED', 'CHECKED_IN', 'ACTIVE', 'WITHDRAWN', 'DISQUALIFIED', 'DNS');

-- CreateEnum
CREATE TYPE "TeamType" AS ENUM ('NATIONAL', 'CLUB', 'WOMEN', 'MIXED', 'OPEN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TeamMemberRole" AS ENUM ('PILOT', 'RESERVE', 'CAPTAIN', 'VICE_CAPTAIN');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('SCHEDULED', 'BRIEFING', 'OPEN', 'ACTIVE', 'PAUSED', 'CLOSED', 'PENDING_APPROVAL', 'APPROVED', 'LOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RoundType" AS ENUM ('PRACTICE', 'OFFICIAL', 'REFLIGHT', 'RESTART');

-- CreateEnum
CREATE TYPE "FlightOrderType" AS ENUM ('RANDOM', 'SEEDED', 'MANUAL', 'REVERSE');

-- CreateEnum
CREATE TYPE "FlightStatus" AS ENUM ('PENDING', 'ON_DECK', 'LAUNCHED', 'LANDED', 'SCORED', 'REFLIGHT', 'DNF', 'ABS', 'DNS', 'DSQ');

-- CreateEnum
CREATE TYPE "ScoreStatus" AS ENUM ('DRAFT', 'ENTERED', 'CONFIRMED', 'DISPUTED', 'APPROVED', 'LOCKED', 'VOID');

-- CreateEnum
CREATE TYPE "ScoreResultType" AS ENUM ('MEASURED', 'BULLSEYE', 'MAXIMUM', 'DNF', 'ABS', 'DNS', 'DSQ', 'REFLIGHT', 'PENALTY');

-- CreateEnum
CREATE TYPE "PenaltyType" AS ENUM ('WARNING', 'DISTANCE_ADD', 'ROUND_MAXIMUM', 'DISQUALIFICATION', 'TECHNICAL', 'BEHAVIOURAL', 'SAFETY', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PrintStatus" AS ENUM ('PENDING', 'PREVIEW', 'APPROVED', 'PRINTED', 'ARCHIVED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PUBLIC_USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "avatarUrl" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionUser" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "code2" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "flagUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "organizer" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "practiceDays" INTEGER NOT NULL DEFAULT 0,
    "officialDays" INTEGER NOT NULL DEFAULT 1,
    "maxRounds" INTEGER NOT NULL DEFAULT 8,
    "practiceRounds" INTEGER NOT NULL DEFAULT 2,
    "targetDiameterCm" INTEGER NOT NULL DEFAULT 200,
    "ruleSet" "RuleSetVersion" NOT NULL DEFAULT 'FAI_2022',
    "status" "CompetitionStatus" NOT NULL DEFAULT 'DRAFT',
    "logoUrl" TEXT,
    "organizerLogoUrl" TEXT,
    "brandingJson" JSONB,
    "weatherConfig" JSONB,
    "faiCategory" TEXT NOT NULL DEFAULT '2',
    "publicSlug" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionSettings" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "bullseyeScoreCm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maximumScoreCm" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "measuringUnit" TEXT NOT NULL DEFAULT 'cm',
    "discardWorstRounds" INTEGER NOT NULL DEFAULT 0,
    "discardAfterRounds" INTEGER NOT NULL DEFAULT 5,
    "allowReflights" BOOLEAN NOT NULL DEFAULT true,
    "maxReflightsPerRound" INTEGER NOT NULL DEFAULT 1,
    "teamSize" INTEGER NOT NULL DEFAULT 4,
    "teamScoringPilots" INTEGER NOT NULL DEFAULT 3,
    "teamAllowReserves" BOOLEAN NOT NULL DEFAULT true,
    "teamMaxReserves" INTEGER NOT NULL DEFAULT 1,
    "womenCategoryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "juniorCategoryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "juniorMaxAge" INTEGER NOT NULL DEFAULT 25,
    "countryRankingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoPrintOnRoundClose" BOOLEAN NOT NULL DEFAULT false,
    "requireChiefJudgeApproval" BOOLEAN NOT NULL DEFAULT true,
    "requireDirectorApproval" BOOLEAN NOT NULL DEFAULT true,
    "livePublicResults" BOOLEAN NOT NULL DEFAULT true,
    "offlineModeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "customRulesJson" JSONB,
    "tieBreakRulesJson" JSONB,
    "penaltyRulesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleProfile" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT,
    "name" TEXT NOT NULL,
    "version" "RuleSetVersion" NOT NULL,
    "description" TEXT,
    "rulesJson" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pilot" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "pilotNumber" INTEGER NOT NULL,
    "faiLicense" TEXT,
    "civlId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL DEFAULT 'MALE',
    "nationality" TEXT,
    "countryId" TEXT,
    "club" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "photoUrl" TEXT,
    "glider" TEXT,
    "gliderSize" TEXT,
    "harness" TEXT,
    "reserveStatus" TEXT,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "medicalNotes" TEXT,
    "status" "PilotStatus" NOT NULL DEFAULT 'REGISTERED',
    "qrCode" TEXT,
    "barcode" TEXT,
    "isJunior" BOOLEAN NOT NULL DEFAULT false,
    "isWomen" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pilot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TeamType" NOT NULL DEFAULT 'NATIONAL',
    "countryId" TEXT,
    "logoUrl" TEXT,
    "captainId" TEXT,
    "viceCaptainId" TEXT,
    "maxSize" INTEGER NOT NULL DEFAULT 4,
    "scoringPilots" INTEGER NOT NULL DEFAULT 3,
    "maxReserves" INTEGER NOT NULL DEFAULT 1,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "validationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "pilotId" TEXT NOT NULL,
    "role" "TeamMemberRole" NOT NULL DEFAULT 'PILOT',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT,
    "type" "RoundType" NOT NULL DEFAULT 'OFFICIAL',
    "status" "RoundStatus" NOT NULL DEFAULT 'SCHEDULED',
    "orderType" "FlightOrderType" NOT NULL DEFAULT 'RANDOM',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "parentRoundId" TEXT,
    "windDirection" DOUBLE PRECISION,
    "windSpeed" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flight" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "pilotId" TEXT NOT NULL,
    "flightOrder" INTEGER NOT NULL,
    "status" "FlightStatus" NOT NULL DEFAULT 'PENDING',
    "launchedAt" TIMESTAMP(3),
    "landedAt" TIMESTAMP(3),
    "isReflight" BOOLEAN NOT NULL DEFAULT false,
    "reflightReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "pilotId" TEXT NOT NULL,
    "distanceCm" DOUBLE PRECISION,
    "resultType" "ScoreResultType" NOT NULL DEFAULT 'MEASURED',
    "status" "ScoreStatus" NOT NULL DEFAULT 'DRAFT',
    "penaltyCm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalScoreCm" DOUBLE PRECISION,
    "isBullseye" BOOLEAN NOT NULL DEFAULT false,
    "isDiscarded" BOOLEAN NOT NULL DEFAULT false,
    "judgeNotes" TEXT,
    "enteredById" TEXT,
    "enteredAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Penalty" (
    "id" TEXT NOT NULL,
    "scoreId" TEXT,
    "pilotId" TEXT NOT NULL,
    "type" "PenaltyType" NOT NULL,
    "amountCm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "ruleReference" TEXT,
    "issuedBy" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Penalty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreApproval" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "roundId" TEXT,
    "category" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndividualRanking" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "pilotId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OVERALL',
    "rank" INTEGER NOT NULL,
    "totalScoreCm" DOUBLE PRECISION NOT NULL,
    "roundsFlown" INTEGER NOT NULL DEFAULT 0,
    "bullseyes" INTEGER NOT NULL DEFAULT 0,
    "discardedScoreCm" DOUBLE PRECISION,
    "tieBreakNotes" TEXT,
    "auditJson" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndividualRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamScore" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "totalScoreCm" DOUBLE PRECISION NOT NULL,
    "countedPilots" JSONB NOT NULL,
    "discardedPilots" JSONB,
    "auditJson" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamRanking" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OVERALL',
    "rank" INTEGER NOT NULL,
    "totalScoreCm" DOUBLE PRECISION NOT NULL,
    "roundsScored" INTEGER NOT NULL DEFAULT 0,
    "tieBreakNotes" TEXT,
    "auditJson" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sponsor" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'STANDARD',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisplayLayout" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "configJson" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisplayLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Weather" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "temperatureC" DOUBLE PRECISION,
    "humidityPct" DOUBLE PRECISION,
    "pressureHpa" DOUBLE PRECISION,
    "conditions" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "Weather_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wind" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "directionDeg" DOUBLE PRECISION NOT NULL,
    "speedMs" DOUBLE PRECISION NOT NULL,
    "gustMs" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "Wind_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintHistory" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "roundId" TEXT,
    "reportType" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'A4_PORTRAIT',
    "status" "PrintStatus" NOT NULL DEFAULT 'PENDING',
    "fileUrl" TEXT,
    "previewUrl" TEXT,
    "pageCount" INTEGER,
    "printedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "printedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "isLive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payloadJson" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineSyncQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "OfflineSyncQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "CompetitionUser_competitionId_idx" ON "CompetitionUser"("competitionId");

-- CreateIndex
CREATE INDEX "CompetitionUser_userId_idx" ON "CompetitionUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionUser_competitionId_userId_role_key" ON "CompetitionUser"("competitionId", "userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Country_code2_key" ON "Country"("code2");

-- CreateIndex
CREATE INDEX "Country_code_idx" ON "Country"("code");

-- CreateIndex
CREATE INDEX "Country_name_idx" ON "Country"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Competition_code_key" ON "Competition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Competition_publicSlug_key" ON "Competition"("publicSlug");

-- CreateIndex
CREATE INDEX "Competition_code_idx" ON "Competition"("code");

-- CreateIndex
CREATE INDEX "Competition_status_idx" ON "Competition"("status");

-- CreateIndex
CREATE INDEX "Competition_publicSlug_idx" ON "Competition"("publicSlug");

-- CreateIndex
CREATE INDEX "Competition_startDate_idx" ON "Competition"("startDate");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionSettings_competitionId_key" ON "CompetitionSettings"("competitionId");

-- CreateIndex
CREATE INDEX "RuleProfile_version_idx" ON "RuleProfile"("version");

-- CreateIndex
CREATE INDEX "RuleProfile_competitionId_idx" ON "RuleProfile"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "Pilot_qrCode_key" ON "Pilot"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "Pilot_barcode_key" ON "Pilot"("barcode");

-- CreateIndex
CREATE INDEX "Pilot_competitionId_idx" ON "Pilot"("competitionId");

-- CreateIndex
CREATE INDEX "Pilot_lastName_firstName_idx" ON "Pilot"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Pilot_countryId_idx" ON "Pilot"("countryId");

-- CreateIndex
CREATE INDEX "Pilot_status_idx" ON "Pilot"("status");

-- CreateIndex
CREATE INDEX "Pilot_faiLicense_idx" ON "Pilot"("faiLicense");

-- CreateIndex
CREATE UNIQUE INDEX "Pilot_competitionId_pilotNumber_key" ON "Pilot"("competitionId", "pilotNumber");

-- CreateIndex
CREATE INDEX "Team_competitionId_idx" ON "Team"("competitionId");

-- CreateIndex
CREATE INDEX "Team_type_idx" ON "Team"("type");

-- CreateIndex
CREATE INDEX "Team_countryId_idx" ON "Team"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_competitionId_name_key" ON "Team"("competitionId", "name");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE INDEX "TeamMember_pilotId_idx" ON "TeamMember"("pilotId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_pilotId_key" ON "TeamMember"("teamId", "pilotId");

-- CreateIndex
CREATE INDEX "Round_competitionId_idx" ON "Round"("competitionId");

-- CreateIndex
CREATE INDEX "Round_status_idx" ON "Round"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Round_competitionId_number_type_key" ON "Round"("competitionId", "number", "type");

-- CreateIndex
CREATE INDEX "Flight_roundId_idx" ON "Flight"("roundId");

-- CreateIndex
CREATE INDEX "Flight_pilotId_idx" ON "Flight"("pilotId");

-- CreateIndex
CREATE INDEX "Flight_status_idx" ON "Flight"("status");

-- CreateIndex
CREATE INDEX "Flight_flightOrder_idx" ON "Flight"("flightOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Flight_roundId_pilotId_key" ON "Flight"("roundId", "pilotId");

-- CreateIndex
CREATE UNIQUE INDEX "Flight_roundId_flightOrder_key" ON "Flight"("roundId", "flightOrder");

-- CreateIndex
CREATE INDEX "Score_roundId_idx" ON "Score"("roundId");

-- CreateIndex
CREATE INDEX "Score_pilotId_idx" ON "Score"("pilotId");

-- CreateIndex
CREATE INDEX "Score_status_idx" ON "Score"("status");

-- CreateIndex
CREATE INDEX "Score_finalScoreCm_idx" ON "Score"("finalScoreCm");

-- CreateIndex
CREATE UNIQUE INDEX "Score_flightId_key" ON "Score"("flightId");

-- CreateIndex
CREATE INDEX "Penalty_pilotId_idx" ON "Penalty"("pilotId");

-- CreateIndex
CREATE INDEX "Penalty_scoreId_idx" ON "Penalty"("scoreId");

-- CreateIndex
CREATE INDEX "Penalty_type_idx" ON "Penalty"("type");

-- CreateIndex
CREATE INDEX "ScoreApproval_roundId_idx" ON "ScoreApproval"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreApproval_roundId_approverId_role_key" ON "ScoreApproval"("roundId", "approverId", "role");

-- CreateIndex
CREATE INDEX "Result_competitionId_idx" ON "Result"("competitionId");

-- CreateIndex
CREATE INDEX "Result_roundId_idx" ON "Result"("roundId");

-- CreateIndex
CREATE INDEX "Result_category_idx" ON "Result"("category");

-- CreateIndex
CREATE INDEX "Result_isOfficial_idx" ON "Result"("isOfficial");

-- CreateIndex
CREATE INDEX "IndividualRanking_competitionId_category_rank_idx" ON "IndividualRanking"("competitionId", "category", "rank");

-- CreateIndex
CREATE INDEX "IndividualRanking_pilotId_idx" ON "IndividualRanking"("pilotId");

-- CreateIndex
CREATE UNIQUE INDEX "IndividualRanking_competitionId_pilotId_category_key" ON "IndividualRanking"("competitionId", "pilotId", "category");

-- CreateIndex
CREATE INDEX "TeamScore_roundId_idx" ON "TeamScore"("roundId");

-- CreateIndex
CREATE INDEX "TeamScore_teamId_idx" ON "TeamScore"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamScore_teamId_roundId_key" ON "TeamScore"("teamId", "roundId");

-- CreateIndex
CREATE INDEX "TeamRanking_competitionId_category_rank_idx" ON "TeamRanking"("competitionId", "category", "rank");

-- CreateIndex
CREATE INDEX "TeamRanking_teamId_idx" ON "TeamRanking"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamRanking_competitionId_teamId_category_key" ON "TeamRanking"("competitionId", "teamId", "category");

-- CreateIndex
CREATE INDEX "Sponsor_competitionId_idx" ON "Sponsor"("competitionId");

-- CreateIndex
CREATE INDEX "DisplayLayout_competitionId_idx" ON "DisplayLayout"("competitionId");

-- CreateIndex
CREATE INDEX "Weather_competitionId_recordedAt_idx" ON "Weather"("competitionId", "recordedAt");

-- CreateIndex
CREATE INDEX "Wind_competitionId_recordedAt_idx" ON "Wind"("competitionId", "recordedAt");

-- CreateIndex
CREATE INDEX "Document_competitionId_idx" ON "Document"("competitionId");

-- CreateIndex
CREATE INDEX "Document_type_idx" ON "Document"("type");

-- CreateIndex
CREATE INDEX "PrintHistory_competitionId_idx" ON "PrintHistory"("competitionId");

-- CreateIndex
CREATE INDEX "PrintHistory_roundId_idx" ON "PrintHistory"("roundId");

-- CreateIndex
CREATE INDEX "PrintHistory_reportType_idx" ON "PrintHistory"("reportType");

-- CreateIndex
CREATE INDEX "PrintHistory_status_idx" ON "PrintHistory"("status");

-- CreateIndex
CREATE INDEX "Announcement_competitionId_isLive_idx" ON "Announcement"("competitionId", "isLive");

-- CreateIndex
CREATE INDEX "AuditLog_competitionId_idx" ON "AuditLog"("competitionId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_competitionId_idx" ON "Notification"("competitionId");

-- CreateIndex
CREATE INDEX "OfflineSyncQueue_userId_status_idx" ON "OfflineSyncQueue"("userId", "status");

-- CreateIndex
CREATE INDEX "OfflineSyncQueue_clientId_idx" ON "OfflineSyncQueue"("clientId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionUser" ADD CONSTRAINT "CompetitionUser_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionUser" ADD CONSTRAINT "CompetitionUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionSettings" ADD CONSTRAINT "CompetitionSettings_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleProfile" ADD CONSTRAINT "RuleProfile_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pilot" ADD CONSTRAINT "Pilot_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pilot" ADD CONSTRAINT "Pilot_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "Pilot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_parentRoundId_fkey" FOREIGN KEY ("parentRoundId") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "Pilot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "Pilot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penalty" ADD CONSTRAINT "Penalty_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "Score"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penalty" ADD CONSTRAINT "Penalty_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "Pilot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreApproval" ADD CONSTRAINT "ScoreApproval_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreApproval" ADD CONSTRAINT "ScoreApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualRanking" ADD CONSTRAINT "IndividualRanking_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualRanking" ADD CONSTRAINT "IndividualRanking_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "Pilot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamScore" ADD CONSTRAINT "TeamScore_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamScore" ADD CONSTRAINT "TeamScore_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRanking" ADD CONSTRAINT "TeamRanking_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRanking" ADD CONSTRAINT "TeamRanking_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sponsor" ADD CONSTRAINT "Sponsor_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisplayLayout" ADD CONSTRAINT "DisplayLayout_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Weather" ADD CONSTRAINT "Weather_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wind" ADD CONSTRAINT "Wind_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintHistory" ADD CONSTRAINT "PrintHistory_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintHistory" ADD CONSTRAINT "PrintHistory_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintHistory" ADD CONSTRAINT "PrintHistory_printedById_fkey" FOREIGN KEY ("printedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncQueue" ADD CONSTRAINT "OfflineSyncQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

