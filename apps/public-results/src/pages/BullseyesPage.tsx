import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { formatScoreCm } from '@aero-judge/utils';
import { PilotChip, RankBadge } from '@aero-judge/ui';
import { Layout } from '../components/Layout';
import { competitionPath, pilotProfilePath } from '../lib/api';
import { useResults, useSlug } from '../hooks/useCompetition';
import type { PublicRankingRow } from '../lib/types';
import { pilotFullName } from '../lib/utils';

interface BullseyePilot {
  rank: number;
  count: number;
  rounds: number[];
  totalScoreCm: number;
  pilotNumber: number | null;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  aeroJudgeId?: string | null;
  countryCode?: string;
  countryCode2?: string;
}

function bullseyePilots(rankings: PublicRankingRow[]): BullseyePilot[] {
  const rows = rankings
    .map((row) => {
      const pilot = row.pilot;
      if (!pilot) return null;
      const rounds = (row.roundScores ?? [])
        .filter((score) => score.isBullseye && !score.isProvisional)
        .map((score) => score.round)
        .sort((a, b) => a - b);
      const count = Math.max(row.bullseyes ?? 0, rounds.length);
      if (count < 1) return null;
      return {
        rank: 0,
        count,
        rounds,
        totalScoreCm: row.totalScoreCm,
        pilotNumber: pilot.pilotNumber ?? null,
        firstName: pilot.firstName,
        lastName: pilot.lastName,
        photoUrl: pilot.photoUrl,
        aeroJudgeId: pilot.aeroJudgeId,
        countryCode: pilot.country?.code,
        countryCode2: pilot.country?.code2,
      };
    })
    .filter((row): row is BullseyePilot => row != null);

  rows.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.totalScoreCm !== b.totalScoreCm) return a.totalScoreCm - b.totalScoreCm;
    return pilotFullName(a.firstName, a.lastName).localeCompare(pilotFullName(b.firstName, b.lastName));
  });

  let rank = 0;
  let previousCount = -1;
  rows.forEach((row, index) => {
    if (row.count !== previousCount) {
      rank = index + 1;
      previousCount = row.count;
    }
    row.rank = rank;
  });
  return rows;
}

export function BullseyesPage() {
  const competitionId = useSlug();
  const { data, isLoading } = useResults('OVERALL');
  const pilots = useMemo(() => bullseyePilots(data?.rankings ?? []), [data?.rankings]);
  const columns = Math.max(1, ...pilots.map((pilot) => pilot.rounds.length));

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          to={competitionPath(competitionId, 'results')}
          className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Results
        </Link>
        <h1 className="mt-6 font-display text-3xl font-bold text-foreground">Bullseyes</h1>
        <p className="mt-2 text-muted-foreground">
          Pilots ranked by how many bullseyes they scored, with the round of each one.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          </div>
        ) : pilots.length === 0 ? (
          <p className="mt-8 text-muted-foreground">No bullseyes yet.</p>
        ) : (
          <ol className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {pilots.map((pilot) => {
              const name = pilotFullName(pilot.firstName, pilot.lastName);
              const profile = pilotProfilePath(competitionId, {
                pilotNumber: pilot.pilotNumber,
                aeroJudgeId: pilot.aeroJudgeId,
              });
              return (
                <li key={`${pilot.pilotNumber ?? name}-${pilot.rank}`}>
                  <Link
                    to={profile ?? competitionPath(competitionId, 'pilots')}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
                  >
                    <RankBadge rank={pilot.rank} size="sm" />
                    <span className="min-w-0 flex-1">
                      <PilotCell pilot={pilot} />
                    </span>
                    <span
                      className="grid shrink-0 gap-x-3"
                      style={{ gridTemplateColumns: `repeat(${columns}, 3.25rem)` }}
                    >
                      {Array.from({ length: columns }, (_, index) => {
                        const round = pilot.rounds[index];
                        if (round == null) return <span key={index} />;
                        return (
                          <span key={round} className="flex flex-col items-center">
                            <span className="font-mono text-sm font-semibold tabular-nums text-[hsl(var(--score-bullseye))]">
                              {formatScoreCm(0)}
                            </span>
                            <span className="text-[11px] font-medium text-muted-foreground">R{round}</span>
                          </span>
                        );
                      })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Layout>
  );
}

function PilotCell({ pilot }: { pilot: BullseyePilot }) {
  if (pilot.pilotNumber == null) {
    return (
      <span className="font-medium text-foreground">
        {pilotFullName(pilot.firstName, pilot.lastName)}
      </span>
    );
  }
  return (
    <PilotChip
      pilotNumber={pilot.pilotNumber}
      firstName={pilot.firstName}
      lastName={pilot.lastName}
      countryCode2={pilot.countryCode2}
      countryCode={pilot.countryCode}
      photoUrl={pilot.photoUrl}
      size="sm"
    />
  );
}
