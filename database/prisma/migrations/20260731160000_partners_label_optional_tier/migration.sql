-- AlterTable CompetitionSettings: partners terminology + optional tiers
ALTER TABLE "CompetitionSettings" ADD COLUMN "partnersLabel" TEXT NOT NULL DEFAULT 'Sponsors';
ALTER TABLE "CompetitionSettings" ADD COLUMN "partnerTiersEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable Sponsor: tier optional (supporters may have no type)
ALTER TABLE "Sponsor" ALTER COLUMN "tier" DROP DEFAULT;
ALTER TABLE "Sponsor" ALTER COLUMN "tier" DROP NOT NULL;
