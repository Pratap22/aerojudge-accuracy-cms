-- Rewrite Person.aeroJudgeId from legacy AJ-* codes to sequential all-numeric IDs
-- starting at 001 (zero-padded to 3 digits; 1000+ stay unpadded).
-- Two-phase update avoids unique collisions mid-migration.

UPDATE "Person"
SET "aeroJudgeId" = 'MIG-' || "id";

WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) AS seq
  FROM "Person"
)
UPDATE "Person" AS p
SET "aeroJudgeId" = CASE
  WHEN n.seq < 1000 THEN LPAD(n.seq::text, 3, '0')
  ELSE n.seq::text
END
FROM numbered AS n
WHERE p.id = n.id;
