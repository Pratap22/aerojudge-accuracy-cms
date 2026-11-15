-- AeroJudge is listed as a default public/venue partner unless organisers opt out.
ALTER TABLE "CompetitionSettings" ADD COLUMN "aeroJudgeAsPartner" BOOLEAN NOT NULL DEFAULT true;
