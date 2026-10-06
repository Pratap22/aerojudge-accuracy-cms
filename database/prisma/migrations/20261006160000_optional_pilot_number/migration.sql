-- Pilots can be registered before the bib draw. Unassigned numbers stay null.
ALTER TABLE "Pilot" ALTER COLUMN "pilotNumber" DROP NOT NULL;
