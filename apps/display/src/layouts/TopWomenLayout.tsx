import { AnimatedLeaderboard } from '../components/AnimatedLeaderboard';
import { SponsorStrip } from '../components/SponsorStrip';
import type { LeaderboardEntry } from '@aero-judge/ui';

interface TopWomenLayoutProps {
  entries: LeaderboardEntry[];
  autoAdvance?: boolean;
  onAutoAdvance?: () => void;
}

export function TopWomenLayout({ entries, autoAdvance, onAutoAdvance }: TopWomenLayoutProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden p-6 sm:p-10">
        <AnimatedLeaderboard
          entries={entries}
          title="Women's Ranking"
          maxRows={10}
          autoAdvance={autoAdvance}
          onAutoAdvance={onAutoAdvance}
        />
      </div>
      <SponsorStrip />
    </div>
  );
}
