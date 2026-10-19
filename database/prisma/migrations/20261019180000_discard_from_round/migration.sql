-- The stored number used to be the last round that counted in full
-- (4 meant "drop the worst score once round 5 starts").
-- It is now the round the discard starts, so existing values move forward by one
-- and current results stay the same.
UPDATE "CompetitionSettings"
SET "discardAfterRounds" = "discardAfterRounds" + 1
WHERE "discardAfterRounds" > 0;
