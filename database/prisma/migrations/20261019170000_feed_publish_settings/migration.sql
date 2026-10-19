-- AlterTable
ALTER TABLE "CompetitionSettings" ADD COLUMN "feedPublishScores" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CompetitionSettings" ADD COLUMN "feedPublishReflights" BOOLEAN NOT NULL DEFAULT true;
