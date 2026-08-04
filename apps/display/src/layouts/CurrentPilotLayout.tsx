import { PilotHero } from '../components/PilotHero';
import { SponsorStrip } from '../components/SponsorStrip';
import type { PublicRankingRow } from '../lib/types';

interface CurrentPilotLayoutProps {
  pilot: PublicRankingRow | null;
  competitionName?: string;
  roundNumber?: number;
  liveScoreCm?: number | null;
  isBullseye?: boolean;
  resultLabel?: string;
  hasLastScore?: boolean;
}

export function CurrentPilotLayout({
  pilot,
  competitionName,
  roundNumber = 1,
  liveScoreCm,
  isBullseye,
  resultLabel,
  hasLastScore,
}: CurrentPilotLayoutProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden p-8 xl:p-10">
        <PilotHero
          pilot={pilot}
          competitionName={competitionName}
          roundNumber={roundNumber}
          liveScoreCm={liveScoreCm}
          isBullseye={isBullseye}
          resultLabel={resultLabel}
          hasLastScore={hasLastScore}
        />
      </div>
      <SponsorStrip />
    </div>
  );
}
