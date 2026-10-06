-- CreateTable
CREATE TABLE "Protest" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "pilotId" TEXT,
    "pilotNumber" INTEGER NOT NULL,
    "pilotName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "formUrl" TEXT,
    "formFileName" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Protest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Protest_competitionId_createdAt_idx" ON "Protest"("competitionId", "createdAt");

-- CreateIndex
CREATE INDEX "Protest_pilotId_idx" ON "Protest"("pilotId");

-- AddForeignKey
ALTER TABLE "Protest" ADD CONSTRAINT "Protest_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protest" ADD CONSTRAINT "Protest_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "Pilot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protest" ADD CONSTRAINT "Protest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
