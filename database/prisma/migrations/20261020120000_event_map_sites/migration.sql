-- HQ, takeoff, and landing pins for the public event map.

ALTER TABLE "CompetitionInfo" ADD COLUMN "mapSites" JSONB;

-- Keep an existing single venue pin as HQ.
UPDATE "CompetitionInfo" AS info
SET "mapSites" = jsonb_build_array(
  jsonb_build_object(
    'kind', 'HQ',
    'latitude', competition.latitude,
    'longitude', competition.longitude
  )
)
FROM "Competition" AS competition
WHERE competition.id = info."competitionId"
  AND competition.latitude IS NOT NULL
  AND competition.longitude IS NOT NULL
  AND info."mapSites" IS NULL;
