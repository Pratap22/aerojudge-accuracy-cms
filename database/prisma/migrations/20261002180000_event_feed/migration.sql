-- CreateEnum
CREATE TYPE "EventFeedKind" AS ENUM ('SCORE', 'REFLIGHT', 'PHOTO');

-- CreateTable
CREATE TABLE "EventFeedItem" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "kind" "EventFeedKind" NOT NULL,
    "pilotId" TEXT,
    "pilotNumber" INTEGER,
    "pilotName" TEXT,
    "scoreText" TEXT,
    "reason" TEXT,
    "caption" TEXT,
    "imageUrl" TEXT,
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventFeedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventFeedItem_competitionId_createdAt_idx" ON "EventFeedItem"("competitionId", "createdAt");

-- CreateIndex
CREATE INDEX "EventFeedItem_pilotId_idx" ON "EventFeedItem"("pilotId");

-- AddForeignKey
ALTER TABLE "EventFeedItem" ADD CONSTRAINT "EventFeedItem_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFeedItem" ADD CONSTRAINT "EventFeedItem_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "Pilot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFeedItem" ADD CONSTRAINT "EventFeedItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
