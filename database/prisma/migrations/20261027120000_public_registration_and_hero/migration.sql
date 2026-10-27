-- AlterTable
ALTER TABLE "CompetitionSettings" ADD COLUMN "publicRegistrationEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "CompetitionInfo" ADD COLUMN "heroImageUrl" TEXT;
