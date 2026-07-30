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
  competitionName?: string;
}

export function PilotHero({
  pilot,
  roundNumber = 1,
  liveScoreCm,
  isBullseye = false,
  competitionName,
}: PilotHeroProps) {
  if (!pilot) {
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

  const displayScore = liveScoreCm ?? null;
  const name = pilotFullName(pilot.pilot.firstName, pilot.pilot.lastName);

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
        <CountryFlag code={pilot.pilot.country.code} size="lg" />
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
        <p className="mb-8 text-2xl text-sky-300">{pilot.pilot.country.name}</p>

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

        {displayScore != null && (
          <motion.div
            key={displayScore}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <ScoreDisplay
              scoreCm={displayScore}
              isBullseye={isBullseye || displayScore === 0}
              size="xl"
              className="border-sky-500/30 bg-broadcast-navy-light/80"
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
