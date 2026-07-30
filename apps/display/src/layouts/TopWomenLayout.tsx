import { AnimatedLeaderboard } from '../components/AnimatedLeaderboard';
import { SponsorStrip } from '../components/SponsorStrip';
import type { LeaderboardEntry } from '@npha/ui';

interface TopWomenLayoutProps {
  entries: LeaderboardEntry[];
}

export function TopWomenLayout({ entries }: TopWomenLayoutProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 p-10">
        <AnimatedLeaderboard entries={entries} title="Women's Ranking" maxRows={10} />
      </div>
      <SponsorStrip />
    </div>
  );
}
