-- AlterEnum
ALTER TYPE "EventFeedKind" ADD VALUE IF NOT EXISTS 'TEXT';

-- AlterTable
ALTER TABLE "EventFeedItem" ADD COLUMN "pilotPhotoUrl" TEXT;
ALTER TABLE "EventFeedItem" ADD COLUMN "roundNumber" INTEGER;
ALTER TABLE "EventFeedItem" ADD COLUMN "sourceKey" TEXT;
ALTER TABLE "EventFeedItem" ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "EventFeedItem" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

ALTER TABLE "EventFeedItem" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "EventFeedItem" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "EventFeedItem_competitionId_sourceKey_key" ON "EventFeedItem"("competitionId", "sourceKey");

-- CreateIndex
CREATE INDEX "EventFeedItem_competitionId_updatedAt_idx" ON "EventFeedItem"("competitionId", "updatedAt");
