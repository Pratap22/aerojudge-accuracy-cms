-- AlterTable
ALTER TABLE "Round" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "Round" ADD COLUMN "approvedByRole" TEXT;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Round_approvedById_idx" ON "Round"("approvedById");
