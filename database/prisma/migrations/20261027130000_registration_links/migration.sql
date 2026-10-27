-- CreateEnum
CREATE TYPE "CompetitionLinkKind" AS ENUM ('EVENT', 'REGISTRATION');

-- AlterTable
ALTER TABLE "CompetitionLink" ADD COLUMN "kind" "CompetitionLinkKind" NOT NULL DEFAULT 'EVENT';

-- CreateIndex
CREATE INDEX "CompetitionLink_competitionId_kind_idx" ON "CompetitionLink"("competitionId", "kind");
