import { AnimatedLeaderboard } from '../components/AnimatedLeaderboard';
import { SponsorStrip } from '../components/SponsorStrip';
import type { LeaderboardEntry } from '@aero-judge/ui';

interface Top10LayoutProps {
  entries: LeaderboardEntry[];
  highlightPilotNumber?: number;
  autoAdvance?: boolean;
  onAutoAdvance?: () => void;
}

export function Top10Layout({
  entries,
  highlightPilotNumber,
  autoAdvance,
  onAutoAdvance,
}: Top10LayoutProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden p-6 sm:p-10">
        <AnimatedLeaderboard
          entries={entries}
          title="Top 10"
          maxRows={10}
          highlightPilotNumber={highlightPilotNumber}
          autoAdvance={autoAdvance}
          onAutoAdvance={onAutoAdvance}
        />
      </div>
      <SponsorStrip />
    </div>
  );
}
