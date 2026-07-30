import { motion } from 'framer-motion';
import type { PublicRankingRow } from '../lib/types';
import { countryCodeToEmoji, formatScore, pilotFullName } from '../lib/utils';

interface PilotPanelProps {
  pilot: PublicRankingRow | null;
  label: string;
  variant: 'current' | 'previous' | 'next';
}

const variantStyles = {
  current: 'border-sky-400 bg-sky-500/10',
  previous: 'border-white/10 bg-white/5',
  next: 'border-amber-500/40 bg-amber-500/5',
};

const labelColors = {
  current: 'text-sky-400',
  previous: 'text-white/40',
  next: 'text-amber-400',
};

export function PilotPanel({ pilot, label, variant }: PilotPanelProps) {
  return (
    <motion.div
      layout
      className={`rounded-xl border-2 p-5 ${variantStyles[variant]}`}
    >
      <p className={`mb-3 text-xs font-bold uppercase tracking-[0.25em] ${labelColors[variant]}`}>
        {label}
      </p>
      {pilot ? (
        <div>
          <div className="mb-2 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 font-bold text-tent-navy">
              {pilot.pilot.pilotNumber}
            </span>
            <span className="text-2xl">{countryCodeToEmoji(pilot.pilot.country.code)}</span>
          </div>
          <h3 className="text-xl font-bold text-white">
            {pilotFullName(pilot.pilot.firstName, pilot.pilot.lastName)}
          </h3>
          <p className="mt-1 text-sm text-white/50">{pilot.pilot.country.name}</p>
          <div className="mt-3 flex gap-4 text-sm">
            <span className="text-sky-300">Rank #{pilot.rank}</span>
            <span className="font-mono text-white">{formatScore(pilot.totalScoreCm)} cm</span>
          </div>
        </div>
      ) : (
        <p className="text-white/30">—</p>
      )}
    </motion.div>
  );
}
