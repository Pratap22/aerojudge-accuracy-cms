import { PilotHero } from '../components/PilotHero';
import { SponsorStrip } from '../components/SponsorStrip';
import type { PublicRankingRow } from '../lib/types';

interface CurrentPilotLayoutProps {
  pilot: PublicRankingRow | null;
  competitionName?: string;
  roundNumber?: number;
  liveScoreCm?: number | null;
  isBullseye?: boolean;
}

export function CurrentPilotLayout({
  pilot,
  competitionName,
  roundNumber = 1,
  liveScoreCm,
  isBullseye,
}: CurrentPilotLayoutProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 p-10">
        <PilotHero
          pilot={pilot}
          competitionName={competitionName}
          roundNumber={roundNumber}
          liveScoreCm={liveScoreCm}
          isBullseye={isBullseye}
        />
      </div>
      <SponsorStrip />
    </div>
  );
}
