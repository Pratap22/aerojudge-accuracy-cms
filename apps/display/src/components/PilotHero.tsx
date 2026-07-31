import { motion } from 'framer-motion';
import { ScoreDisplay } from '@npha/ui';
import { CountryFlag } from './CountryFlag';
import { formatScore, pilotFullName } from '../lib/utils';
import type { PublicRankingRow } from '../lib/types';

interface PilotHeroProps {
  pilot: PublicRankingRow | null;
  roundNumber?: number;
  liveScoreCm?: number | null;
  isBullseye?: boolean;
  resultLabel?: string;
  competitionName?: string;
  /** When false, show “awaiting score” instead of hiding the score panel */
  hasLastScore?: boolean;
}

export function PilotHero({
  pilot,
  roundNumber = 1,
  liveScoreCm,
  isBullseye = false,
  resultLabel,
  competitionName,
  hasLastScore = false,
}: PilotHeroProps) {
  if (!pilot?.pilot) {
    return (
      <div className="flex h-full items-center justify-center">
        <motion.p
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="font-display text-4xl uppercase tracking-widest text-sky-400/60"
        >
          Awaiting pilot…
        </motion.p>
      </div>
    );
  }

  const name = pilotFullName(pilot.pilot.firstName, pilot.pilot.lastName);
  const showScore = hasLastScore || liveScoreCm != null || Boolean(resultLabel);

  return (
    <div className="grid h-full grid-cols-12 gap-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="col-span-5 flex flex-col items-center justify-center rounded-2xl border border-sky-500/20 bg-gradient-to-br from-broadcast-navy-light to-broadcast-navy-mid p-8"
      >
        <div className="mb-6 flex h-48 w-48 items-center justify-center rounded-full border-4 border-sky-500/30 bg-broadcast-navy">
          <span className="font-display text-8xl text-sky-400">{pilot.pilot.pilotNumber}</span>
        </div>
        <CountryFlag code={pilot.pilot.country?.code ?? pilot.pilot.nationality ?? 'XX'} size="lg" />
      </motion.div>

      <div className="col-span-7 flex flex-col justify-center">
        {competitionName && (
          <p className="mb-2 text-sm uppercase tracking-[0.4em] text-sky-400/60">{competitionName}</p>
        )}
        <motion.h1
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-2 font-display text-7xl uppercase leading-none tracking-wide text-white"
        >
          {name}
        </motion.h1>
        <p className="mb-8 text-2xl text-sky-300">
          {pilot.pilot.country?.name ?? pilot.pilot.nationality ?? '—'}
        </p>

        <div className="mb-8 flex items-center gap-8">
          <div>
            <p className="text-sm uppercase tracking-widest text-sky-400/70">Round</p>
            <p className="font-display text-5xl text-white">{roundNumber}</p>
          </div>
          <div>
            <p className="text-sm uppercase tracking-widest text-sky-400/70">Overall Rank</p>
            <p className="font-display text-5xl text-broadcast-amber">#{pilot.rank}</p>
          </div>
          <div>
            <p className="text-sm uppercase tracking-widest text-sky-400/70">Total</p>
            <p className="font-mono text-4xl font-bold text-white">
              {formatScore(pilot.totalScoreCm)} <span className="text-xl text-sky-400">cm</span>
            </p>
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-sky-400/70">Last Score</p>
          {showScore ? (
            <motion.div
              key={`${liveScoreCm}-${resultLabel ?? ''}-${isBullseye}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <ScoreDisplay
                scoreCm={liveScoreCm ?? null}
                isBullseye={isBullseye || liveScoreCm === 0}
                resultLabel={resultLabel}
                size="xl"
                className="border-sky-500/30 bg-broadcast-navy-light/80"
              />
            </motion.div>
          ) : (
            <div className="rounded-xl border border-dashed border-sky-500/20 bg-broadcast-navy-light/40 px-6 py-10 text-center">
              <p className="text-lg text-sky-400/60">Waiting for judge…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
