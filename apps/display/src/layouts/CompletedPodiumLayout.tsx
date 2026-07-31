import { motion } from 'framer-motion';
import type { LeaderboardEntry } from '@npha/ui';
import { SponsorStrip } from '../components/SponsorStrip';
import { formatScore } from '../lib/utils';

interface CompletedPodiumLayoutProps {
  competitionName?: string;
  entries: LeaderboardEntry[];
}

const PODIUM_ORDER = [1, 0, 2] as const; // visual: 2nd · 1st · 3rd
const PLACE_STYLES = [
  {
    place: '1st',
    ring: 'border-amber-400/70 bg-amber-500/15',
    accent: 'text-amber-300',
    height: 'min-h-[280px] sm:min-h-[320px]',
    scale: 'sm:scale-110',
  },
  {
    place: '2nd',
    ring: 'border-slate-300/50 bg-slate-400/10',
    accent: 'text-slate-200',
    height: 'min-h-[220px] sm:min-h-[260px]',
    scale: '',
  },
  {
    place: '3rd',
    ring: 'border-orange-700/50 bg-orange-800/15',
    accent: 'text-orange-300',
    height: 'min-h-[200px] sm:min-h-[230px]',
    scale: '',
  },
] as const;

function podiumCard(entry: LeaderboardEntry | undefined, style: (typeof PLACE_STYLES)[number], delay: number) {
  const label = entry
    ? (entry.displayName ??
        `${entry.firstName}${entry.lastName ? ` ${entry.lastName}` : ''}`.trim())
    : '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 100 }}
      className={`flex w-full max-w-[280px] flex-col justify-end ${style.scale}`}
    >
      <div
        className={`flex ${style.height} flex-col items-center justify-center rounded-2xl border px-6 py-8 text-center ${style.ring}`}
      >
        <p className={`font-display text-4xl uppercase tracking-[0.2em] ${style.accent}`}>
          {style.place}
        </p>
        {entry && !entry.hideNumber && (
          <div className="mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 font-display text-2xl text-broadcast-navy">
            {entry.pilotNumber}
          </div>
        )}
        <p className="mt-4 font-display text-2xl uppercase tracking-wide text-white sm:text-3xl">
          {label}
        </p>
        {entry?.countryCode2 && entry.countryCode2 !== 'XX' && (
          <p className="mt-2 text-sm uppercase tracking-[0.3em] text-sky-400/70">
            {entry.countryCode2}
          </p>
        )}
        {entry && (
          <p className="mt-6 font-mono text-3xl font-bold tabular-nums text-white">
            {formatScore(entry.totalScoreCm)}
            <span className="ml-1 text-lg text-sky-400">cm</span>
          </p>
        )}
      </div>
    </motion.div>
  );
}

/** Full-screen finals podium when the competition is COMPLETED. */
export function CompletedPodiumLayout({ competitionName, entries }: CompletedPodiumLayoutProps) {
  const top3 = [entries[0], entries[1], entries[2]];

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center sm:px-10">
        {competitionName && (
          <p className="mb-4 text-sm uppercase tracking-[0.4em] text-sky-400/60">{competitionName}</p>
        )}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-5xl uppercase tracking-wide text-white sm:text-6xl md:text-7xl"
        >
          Competition completed
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mt-4 text-lg uppercase tracking-[0.35em] text-sky-400/80"
        >
          Official overall podium
        </motion.p>

        <div className="mt-12 flex w-full max-w-5xl flex-col items-center justify-center gap-6 sm:mt-16 sm:flex-row sm:items-end sm:gap-8">
          {PODIUM_ORDER.map((idx, order) =>
            podiumCard(top3[idx], PLACE_STYLES[idx], 0.2 + order * 0.12),
          )}
        </div>
      </div>
      <SponsorStrip />
    </div>
  );
}
