import { useMemo } from 'react';
import { Layout } from '../components/Layout';
import { LeaderboardTable, TeamLeaderboard, type TeamLeaderboardEntry } from '@npha/ui';
import { useResults, toLeaderboardEntries } from '../hooks/useCompetition';

function CategoryPage({
  title,
  category,
  nameColumn,
  showBullseyes = true,
  showRoundScores = false,
}: {
  title: string;
  category: 'WOMEN' | 'TEAM' | 'COUNTRY';
  nameColumn: string;
  showBullseyes?: boolean;
  /** Individual boards: expand every official round with discard strikethrough */
  showRoundScores?: boolean;
}) {
  const { data: results, isLoading } = useResults(category);
  const entries = toLeaderboardEntries(results);

  const teamEntries = useMemo((): TeamLeaderboardEntry[] => {
    if (category !== 'TEAM' || !results?.rankings) return [];
    return results.rankings
      .filter((row) => row.team)
      .map((row) => ({
        rank: row.rank,
        teamId: row.teamId ?? row.team!.id,
        name: row.team!.name,
        countryCode2: row.team!.country?.code || undefined,
        totalScoreCm: row.totalScoreCm,
        roundScores: (row.roundScores ?? []).map((rs) => ({
          round: rs.round,
          scoreCm: rs.scoreCm,
          isBullseye: rs.isBullseye,
          isDiscarded: rs.isDiscarded,
          isProvisional: rs.isProvisional,
        })),
        pilots: (row.pilots ?? []).map((p) => ({
          pilotId: p.pilotId,
          pilotNumber: p.pilotNumber,
          firstName: p.firstName,
          lastName: p.lastName,
          role: p.role,
          photoUrl: p.photoUrl ?? undefined,
          roundScores: (p.roundScores ?? []).map((rs) => ({
            round: rs.round,
            scoreCm: rs.scoreCm,
            isBullseye: rs.isBullseye,
            isDiscarded: rs.isDiscarded,
            isProvisional: rs.isProvisional,
          })),
        })),
      }));
  }, [category, results]);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="mb-8 font-display text-4xl font-bold text-white">{title}</h1>
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          </div>
        ) : category === 'TEAM' ? (
          teamEntries.length === 0 ? (
            <p className="text-sky-300/70">
              No rankings available yet. Approve or lock an official round, then recalculate rankings.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
              <TeamLeaderboard
                entries={teamEntries}
                roundNumbers={results?.roundNumbers}
                highlightPodium
                className="min-w-max [&_th]:border-white/10 [&_th]:text-sky-300/70 [&_td]:border-white/5 [&_tr]:border-white/5 [&_td]:text-white [&_.bg-foreground]:bg-white [&_.text-background]:text-slate-900 [&_.text-muted-foreground]:text-sky-300/60 [&_.bg-muted\/20]:bg-white/[0.03] [&_.bg-muted\/30]:bg-white/[0.06]"
              />
            </div>
          )
        ) : entries.length === 0 ? (
          <p className="text-sky-300/70">
            No rankings available yet. Approve or lock an official round, then recalculate rankings.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
            <LeaderboardTable
              entries={entries}
              nameColumn={nameColumn}
              showBullseyes={showRoundScores ? false : showBullseyes}
              showRounds={!showRoundScores}
              showRoundScores={showRoundScores}
              roundNumbers={results?.roundNumbers}
              highlightPodium
              className="min-w-max [&_th]:border-white/10 [&_th]:text-sky-300/70 [&_td]:border-white/5 [&_.bg-foreground]:bg-white [&_.text-background]:text-slate-900"
            />
          </div>
        )}
      </div>
    </Layout>
  );
}

export function WomenPage() {
  return (
    <CategoryPage
      title="Women's Ranking"
      category="WOMEN"
      nameColumn="Pilot"
      showRoundScores
    />
  );
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
