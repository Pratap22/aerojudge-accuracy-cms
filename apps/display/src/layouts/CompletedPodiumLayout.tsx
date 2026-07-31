import { motion } from 'framer-motion';
import type { LeaderboardEntry } from '@npha/ui';
import { SponsorStrip } from '../components/SponsorStrip';
import { formatScore } from '../lib/utils';

export type PodiumCategory = 'individual' | 'team';

interface CompletedPodiumLayoutProps {
  competitionName?: string;
  entries: LeaderboardEntry[];
  category?: PodiumCategory;
}

/** Visual left→right: 2nd · 1st · 3rd */
const PODIUM_ORDER = [1, 0, 2] as const;

const PLACE_STYLES = [
  {
    place: '1st',
    ring: 'border-amber-400/70 bg-amber-500/15',
    accent: 'text-amber-300',
    height: 'h-72 sm:h-80 md:h-[22rem]',
    width: 'w-full max-w-[300px] sm:max-w-[320px]',
  },
  {
    place: '2nd',
    ring: 'border-slate-300/50 bg-slate-400/10',
    accent: 'text-slate-200',
    height: 'h-56 sm:h-64 md:h-72',
    width: 'w-full max-w-[260px] sm:max-w-[280px]',
  },
  {
    place: '3rd',
    ring: 'border-orange-700/50 bg-orange-800/15',
    accent: 'text-orange-300',
    height: 'h-44 sm:h-52 md:h-60',
    width: 'w-full max-w-[240px] sm:max-w-[260px]',
  },
] as const;

const CATEGORY_COPY: Record<PodiumCategory, { title: string; subtitle: string }> = {
  individual: {
    title: 'Competition completed',
    subtitle: 'Official individual podium',
  },
  team: {
    title: 'Competition completed',
    subtitle: 'Official team podium',
  },
};

function podiumCard(
  entry: LeaderboardEntry | undefined,
  style: (typeof PLACE_STYLES)[number],
  delay: number,
  category: PodiumCategory,
) {
  const label = entry
    ? (entry.displayName ??
        `${entry.firstName}${entry.lastName ? ` ${entry.lastName}` : ''}`.trim())
    : '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 48 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 110 }}
      className={`flex shrink-0 flex-col justify-end ${style.width}`}
    >
      <div
        className={`flex ${style.height} shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border px-5 py-5 text-center sm:px-6 sm:py-6 ${style.ring}`}
      >
        <p className={`font-display text-3xl uppercase tracking-[0.2em] sm:text-4xl ${style.accent}`}>
          {style.place}
        </p>
        {entry && !entry.hideNumber && category === 'individual' && (
          <div className="mt-3 flex h-11 w-11 items-center justify-center rounded-full bg-sky-500 font-display text-lg text-broadcast-navy sm:mt-4 sm:h-12 sm:w-12 sm:text-xl">
            {entry.pilotNumber}
          </div>
        )}
        <p className="mt-3 line-clamp-2 font-display text-lg uppercase tracking-wide text-white sm:mt-4 sm:text-2xl">
          {label}
        </p>
        {entry?.countryCode2 && entry.countryCode2 !== 'XX' && (
          <p className="mt-2 text-xs uppercase tracking-[0.3em] text-sky-400/70 sm:text-sm">
            {entry.countryCode2}
          </p>
        )}
        {entry && (
          <p className="mt-3 font-mono text-xl font-bold tabular-nums text-white sm:mt-4 sm:text-2xl md:text-3xl">
            {formatScore(entry.totalScoreCm)}
            <span className="ml-1 text-sm text-sky-400 sm:text-base">cm</span>
          </p>
        )}
      </div>
    </motion.div>
  );
}

/** Full-screen finals podium when the competition is COMPLETED. */
export function CompletedPodiumLayout({
  competitionName,
  entries,
  category = 'individual',
}: CompletedPodiumLayoutProps) {
  const top3 = [entries[0], entries[1], entries[2]];
  const copy = CATEGORY_COPY[category];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-6 text-center sm:px-10">
        {competitionName && (
          <p className="mb-3 shrink-0 text-sm uppercase tracking-[0.4em] text-sky-400/60">
            {competitionName}
          </p>
        )}
        <motion.p
          key={`title-${category}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="shrink-0 font-display text-4xl uppercase tracking-wide text-white sm:text-5xl md:text-6xl lg:text-7xl"
        >
          {copy.title}
        </motion.p>
        <motion.p
          key={`sub-${category}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12 }}
          className="mt-3 shrink-0 text-base uppercase tracking-[0.35em] text-sky-400/80 sm:text-lg"
        >
          {copy.subtitle}
        </motion.p>

        <div className="mt-8 flex w-full max-w-5xl flex-col items-center justify-end gap-4 pb-2 sm:mt-10 sm:flex-row sm:items-end sm:justify-center sm:gap-6 md:gap-8">
          {PODIUM_ORDER.map((idx, order) =>
            podiumCard(top3[idx], PLACE_STYLES[idx], 0.2 + order * 0.12, category),
          )}
        </div>
      </div>
      <SponsorStrip />
    </div>
  );
}
