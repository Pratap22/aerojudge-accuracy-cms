-- AlterTable
ALTER TABLE "CompetitionParticipant" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Person" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProfileClaimRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;
