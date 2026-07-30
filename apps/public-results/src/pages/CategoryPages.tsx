import { Layout } from '../components/Layout';
import { LeaderboardTable } from '@npha/ui';
import { useResults, toLeaderboardEntries } from '../hooks/useCompetition';

function CategoryPage({
  title,
  category,
  nameColumn,
  showBullseyes = true,
}: {
  title: string;
  category: 'WOMEN' | 'TEAM' | 'COUNTRY';
  nameColumn: string;
  showBullseyes?: boolean;
}) {
  const { data: results, isLoading } = useResults(category);
  const entries = toLeaderboardEntries(results);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="mb-8 font-display text-4xl font-bold text-white">{title}</h1>
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sky-300/70">No rankings available yet. Approve or lock an official round, then recalculate rankings.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <LeaderboardTable
              entries={entries}
              nameColumn={nameColumn}
              showBullseyes={showBullseyes}
              showRounds
              highlightPodium
              className="[&_th]:border-white/10 [&_th]:text-sky-300/70 [&_td]:border-white/5"
            />
          </div>
        )}
      </div>
    </Layout>
  );
}

export function WomenPage() {
  return <CategoryPage title="Women's Ranking" category="WOMEN" nameColumn="Pilot" />;
}

export function TeamsPage() {
  return (
    <CategoryPage title="Team Ranking" category="TEAM" nameColumn="Team" showBullseyes={false} />
  );
}

export function CountriesPage() {
  return (
    <CategoryPage
      title="Country Ranking"
      category="COUNTRY"
      nameColumn="Country"
      showBullseyes={false}
    />
  );
}
