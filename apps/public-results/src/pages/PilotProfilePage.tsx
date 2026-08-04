import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Target } from 'lucide-react';
import { RankBadge, ScoreDisplay } from '@npha/ui';
import { Layout } from '../components/Layout';
import { competitionPath, fetchPilots } from '../lib/api';
import { useResults } from '../hooks/useCompetition';
import { countryCodeToEmoji, formatScore, pilotFullName } from '../lib/utils';

export function PilotProfilePage() {
  const { competitionId, pilotNumber } = useParams<{ competitionId: string; pilotNumber: string }>();
  const location = useLocation();
  const justRegistered = Boolean((location.state as { justRegistered?: boolean } | null)?.justRegistered);
  const num = Number(pilotNumber);

  const { data: results, isLoading: resultsLoading } = useResults('OVERALL');
  const { data: pilotList, isLoading: listLoading } = useQuery({
    queryKey: ['public-pilots', competitionId],
    queryFn: () => fetchPilots(competitionId!),
    enabled: Boolean(competitionId),
  });

  const rankingRow = results?.rankings.find(
    (r) => r.pilot && r.pilot.pilotNumber === num,
  );
  const listPilot = pilotList?.pilots.find((p) => p.pilotNumber === num);

  const isLoading = resultsLoading || listLoading;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!rankingRow?.pilot && !listPilot) {
    return (
      <Layout>
        <div className="mx-auto max-w-7xl px-6 py-12 text-center">
          <h1 className="font-display text-3xl text-white">Pilot Not Found</h1>
          <Link
            to={competitionPath(competitionId ?? '', 'pilots')}
            className="mt-4 inline-block text-sky-400 hover:underline"
          >
            Back to pilots
          </Link>
        </div>
      </Layout>
    );
  }

  const profile = rankingRow?.pilot ?? {
    pilotNumber: listPilot!.pilotNumber,
    firstName: listPilot!.firstName,
    lastName: listPilot!.lastName,
    nationality: listPilot!.nationality,
    country: listPilot!.country,
    photoUrl: listPilot!.photoUrl,
  };
  const photoUrl = rankingRow?.pilot?.photoUrl ?? listPilot?.photoUrl ?? null;

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Link
          to={competitionPath(competitionId ?? '', 'pilots')}
          className="mb-8 inline-flex items-center gap-2 text-sky-400 hover:text-sky-300"
        >
          <ArrowLeft className="h-4 w-4" />
          All Pilots
        </Link>

        {justRegistered && (
          <div className="mb-8 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-200">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p className="text-sm">
              Registration received. You are pilot #{profile.pilotNumber} — organisers can see you
              in the competition pilot list.
            </p>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="mb-6 flex items-start gap-6">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                className="h-16 w-16 rounded-full object-cover object-top ring-2 ring-sky-500/40"
              />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-500 font-display text-3xl text-[#050d1a]">
                {profile.pilotNumber}
              </span>
            )}
            <div>
              {photoUrl ? (
                <p className="mb-1 font-mono text-sky-400">#{profile.pilotNumber}</p>
              ) : null}
              <h1 className="font-display text-4xl font-bold text-white">
                {pilotFullName(profile.firstName, profile.lastName)}
              </h1>
              <p className="mt-2 text-lg text-sky-300">
                {countryCodeToEmoji(profile.country?.code2 ?? profile.country?.code ?? '')}{' '}
                {profile.country?.name ?? profile.nationality ?? '—'}
              </p>
              {listPilot?.club && (
                <p className="mt-1 text-sm text-sky-400/70">{listPilot.club}</p>
              )}
            </div>
            {rankingRow && (
              <div className="ml-auto">
                <RankBadge rank={rankingRow.rank} size="lg" />
              </div>
            )}
          </div>

          {rankingRow ? (
            <div className="grid gap-4 sm:grid-cols-4">
              <StatBox label="Total Score" value={`${formatScore(rankingRow.totalScoreCm)} cm`} />
              <StatBox label="Rounds Flown" value={String(rankingRow.roundsFlown)} />
              <StatBox label="Bullseyes" value={String(rankingRow.bullseyes)} />
              <StatBox label="Rank" value={`#${rankingRow.rank}`} />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatBox label="Status" value={(listPilot?.status ?? 'REGISTERED').replace(/_/g, ' ')} />
              <StatBox label="Glider" value={listPilot?.glider ?? '—'} />
              <StatBox
                label="Category"
                value={
                  listPilot?.isWomen
                    ? 'Women'
                    : listPilot?.isJunior
                      ? 'Junior'
                      : 'Open'
                }
              />
            </div>
          )}
        </motion.div>

        {rankingRow && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl text-white">
              <Target className="h-5 w-5 text-sky-400" />
              Scores
            </h2>
            <p className="text-sky-300/60">
              Overall standing after {rankingRow.roundsFlown} round
              {rankingRow.roundsFlown !== 1 ? 's' : ''}.
            </p>
            <div className="mt-4">
              <ScoreDisplay scoreCm={rankingRow.totalScoreCm} size="lg" />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-wider text-sky-400/60">{label}</p>
      <p className="mt-1 font-display text-xl text-white">{value}</p>
    </div>
  );
}
