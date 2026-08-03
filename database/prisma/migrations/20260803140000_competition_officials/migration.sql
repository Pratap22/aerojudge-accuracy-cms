-- Competition officials/judges shown on public results (photos via Cloudinary URL)
CREATE TABLE "CompetitionOfficial" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "imageUrl" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionOfficial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompetitionOfficial_competitionId_idx" ON "CompetitionOfficial"("competitionId");
CREATE INDEX "CompetitionOfficial_competitionId_isPublic_idx" ON "CompetitionOfficial"("competitionId", "isPublic");

ALTER TABLE "CompetitionOfficial" ADD CONSTRAINT "CompetitionOfficial_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
