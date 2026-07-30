import { Layout } from '../components/Layout';
import { LiveLeaderboard } from '../components/LiveLeaderboard';

export function LeaderboardPage() {
  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <LiveLeaderboard title="Live Leaderboard" showSearch />
      </div>
    </Layout>
  );
}
