import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Target } from 'lucide-react';
import { RankBadge, ScoreDisplay } from '@npha/ui';
import { Layout } from '../components/Layout';
import { competitionPath } from '../lib/api';
import { useResults } from '../hooks/useCompetition';
import { countryCodeToEmoji, formatScore, pilotFullName } from '../lib/utils';

export function PilotProfilePage() {
  const { competitionId, pilotNumber } = useParams<{ competitionId: string; pilotNumber: string }>();
  const { data: results, isLoading } = useResults('OVERALL');

  const pilot = results?.rankings.find((r) => r.pilot.pilotNumber === Number(pilotNumber));

  if (isLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!pilot) {
    return (
      <Layout>
        <div className="mx-auto max-w-7xl px-6 py-12 text-center">
          <h1 className="font-display text-3xl text-white">Pilot Not Found</h1>
          <Link
            to={competitionPath(competitionId ?? '', 'pilots')}
            className="mt-4 inline-block text-sky-400 hover:underline"
          >
            Back to pilot search
          </Link>
        </div>
      </Layout>
    );
  }

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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="mb-6 flex items-start gap-6">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-500 font-display text-3xl text-[#050d1a]">
              {pilot.pilot.pilotNumber}
            </span>
            <div>
              <h1 className="font-display text-4xl font-bold text-white">
                {pilotFullName(pilot.pilot.firstName, pilot.pilot.lastName)}
              </h1>
              <p className="mt-2 text-lg text-sky-300">
                {countryCodeToEmoji(pilot.pilot.country?.code ?? '')}{' '}
                {pilot.pilot.country?.name ?? pilot.pilot.nationality ?? '—'}
              </p>
            </div>
            <div className="ml-auto">
              <RankBadge rank={pilot.rank} size="lg" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <StatBox label="Total Score" value={`${formatScore(pilot.totalScoreCm)} cm`} />
            <StatBox label="Rounds Flown" value={String(pilot.roundsFlown)} />
            <StatBox label="Bullseyes" value={String(pilot.bullseyes)} highlight={pilot.bullseyes > 0} />
            <StatBox label="Rank" value={`#${pilot.rank}`} />
          </div>
        </motion.div>

        <section>
          <h2 className="mb-6 font-display text-2xl text-white">Rank History</h2>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-2 rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(5, 100 - pilot.rank)}%` }}
                    transition={{ duration: 1 }}
                    className="h-full rounded-full bg-sky-500"
                  />
                </div>
              </div>
              <span className="font-mono text-2xl font-bold text-white">#{pilot.rank}</span>
            </div>
            <p className="mt-4 text-sm text-sky-300/60">
              Current overall ranking after {pilot.roundsFlown} round{pilot.roundsFlown !== 1 ? 's' : ''}
            </p>
          </div>
        </section>

        {pilot.bullseyes > 0 && (
          <section className="mt-8">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6">
              <Target className="h-8 w-8 text-emerald-400" />
              <div>
                <p className="font-semibold text-emerald-300">
                  {pilot.bullseyes} Bullseye{pilot.bullseyes !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-emerald-400/70">Perfect accuracy landings</p>
              </div>
            </div>
          </section>
        )}

        <section className="mt-8">
          <ScoreDisplay
            scoreCm={pilot.totalScoreCm}
            pilotName={pilotFullName(pilot.pilot.firstName, pilot.pilot.lastName)}
            pilotNumber={pilot.pilot.pilotNumber}
            size="lg"
            className="border-white/10 bg-white/5"
          />
        </section>
      </div>
    </Layout>
  );
}

function StatBox({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-white/5'
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-sky-400/70">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold ${highlight ? 'text-emerald-400' : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}
