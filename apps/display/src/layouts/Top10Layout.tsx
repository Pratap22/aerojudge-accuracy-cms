import { AnimatedLeaderboard } from '../components/AnimatedLeaderboard';
import { SponsorStrip } from '../components/SponsorStrip';
import type { LeaderboardEntry } from '@npha/ui';

interface Top10LayoutProps {
  entries: LeaderboardEntry[];
  highlightPilotNumber?: number;
}

export function Top10Layout({ entries, highlightPilotNumber }: Top10LayoutProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 p-10">
        <AnimatedLeaderboard
          entries={entries}
          title="Top 10"
          maxRows={10}
          highlightPilotNumber={highlightPilotNumber}
        />
      </div>
      <SponsorStrip />
    </div>
  );
}
