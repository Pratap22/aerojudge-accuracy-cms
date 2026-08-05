-- Competition brochure content: About, schedule, gallery, links, contacts, map metadata

CREATE TABLE "CompetitionInfo" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "aboutHtml" TEXT,
    "dailyScheduleHtml" TEXT,
    "selectionRulesHtml" TEXT,
    "entryFeePaymentHtml" TEXT,
    "flyingSiteHtml" TEXT,
    "travelInfoHtml" TEXT,
    "mapLabel" TEXT,
    "mapZoom" INTEGER NOT NULL DEFAULT 13,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionInfo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompetitionInfo_competitionId_key" ON "CompetitionInfo"("competitionId");

ALTER TABLE "CompetitionInfo" ADD CONSTRAINT "CompetitionInfo_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CompetitionGalleryImage" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionGalleryImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompetitionGalleryImage_competitionId_idx" ON "CompetitionGalleryImage"("competitionId");
CREATE INDEX "CompetitionGalleryImage_competitionId_displayOrder_idx" ON "CompetitionGalleryImage"("competitionId", "displayOrder");

ALTER TABLE "CompetitionGalleryImage" ADD CONSTRAINT "CompetitionGalleryImage_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CompetitionLink" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompetitionLink_competitionId_idx" ON "CompetitionLink"("competitionId");
CREATE INDEX "CompetitionLink_competitionId_displayOrder_idx" ON "CompetitionLink"("competitionId", "displayOrder");

ALTER TABLE "CompetitionLink" ADD CONSTRAINT "CompetitionLink_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CompetitionContact" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompetitionContact_competitionId_idx" ON "CompetitionContact"("competitionId");
CREATE INDEX "CompetitionContact_competitionId_isPublic_idx" ON "CompetitionContact"("competitionId", "isPublic");

ALTER TABLE "CompetitionContact" ADD CONSTRAINT "CompetitionContact_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
