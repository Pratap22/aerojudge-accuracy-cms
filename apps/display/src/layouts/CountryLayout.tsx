import { AnimatedLeaderboard } from '../components/AnimatedLeaderboard';
import { SponsorStrip } from '../components/SponsorStrip';
import type { LeaderboardEntry } from '@npha/ui';

interface CountryLayoutProps {
  entries: LeaderboardEntry[];
}

export function CountryLayout({ entries }: CountryLayoutProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 p-10">
        <AnimatedLeaderboard entries={entries} title="Country Ranking" maxRows={10} />
      </div>
      <SponsorStrip />
    </div>
  );
}
