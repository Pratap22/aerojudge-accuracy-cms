-- Track who approved a print / report PDF

ALTER TABLE "PrintHistory" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "PrintHistory" ADD COLUMN IF NOT EXISTS "approvedByRole" TEXT;

CREATE INDEX IF NOT EXISTS "PrintHistory_approvedById_idx" ON "PrintHistory"("approvedById");

ALTER TABLE "PrintHistory"
  DROP CONSTRAINT IF EXISTS "PrintHistory_approvedById_fkey";

ALTER TABLE "PrintHistory"
  ADD CONSTRAINT "PrintHistory_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
