import { AnimatedLeaderboard } from '../components/AnimatedLeaderboard';
import { SponsorStrip } from '../components/SponsorStrip';
import type { LeaderboardEntry } from '@npha/ui';

interface TopTeamsLayoutProps {
  entries: LeaderboardEntry[];
}

export function TopTeamsLayout({ entries }: TopTeamsLayoutProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 p-10">
        <AnimatedLeaderboard entries={entries} title="Team Ranking" maxRows={10} />
      </div>
      <SponsorStrip />
    </div>
  );
}
