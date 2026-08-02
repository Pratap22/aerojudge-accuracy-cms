import { motion, AnimatePresence } from 'framer-motion';
import type { LeaderboardEntry } from '@npha/ui';
import { CountryFlag } from '../components/CountryFlag';
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
    /** min-height so long names are never clipped mid-glyph */
    height: 'min-h-72 sm:min-h-80 md:min-h-[22rem]',
    width: 'w-full max-w-[300px] sm:max-w-[340px]',
    nameSize: 'text-xl sm:text-2xl md:text-3xl',
  },
  {
    place: '2nd',
    ring: 'border-slate-300/50 bg-slate-400/10',
    accent: 'text-slate-200',
    height: 'min-h-60 sm:min-h-72 md:min-h-80',
    width: 'w-full max-w-[260px] sm:max-w-[300px]',
    nameSize: 'text-lg sm:text-xl md:text-2xl',
  },
  {
    place: '3rd',
    ring: 'border-orange-700/50 bg-orange-800/15',
    accent: 'text-orange-300',
    height: 'min-h-56 sm:min-h-64 md:min-h-72',
    width: 'w-full max-w-[240px] sm:max-w-[280px]',
    nameSize: 'text-base sm:text-lg md:text-xl',
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

  const countryCode = entry?.countryCode2?.trim().toUpperCase();
  const flagCode =
    countryCode && countryCode.length === 2 && countryCode !== 'XX' && /^[A-Z]{2}$/.test(countryCode)
      ? countryCode
      : null;
  const countryLabel = entry?.countryName?.trim() || (flagCode ?? undefined);
  const showCountry = Boolean(countryLabel);

  return (
    <motion.div
      initial={{ opacity: 0, y: 48 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 110 }}
      className={`flex shrink-0 flex-col justify-end ${style.width}`}
    >
      <div
        className={`flex ${style.height} w-full flex-col items-center justify-center gap-2 rounded-2xl border px-4 py-5 text-center sm:gap-3 sm:px-5 sm:py-6 ${style.ring}`}
      >
        <p className={`shrink-0 font-display text-3xl uppercase tracking-[0.2em] sm:text-4xl ${style.accent}`}>
          {style.place}
        </p>
        {entry && !entry.hideNumber && category === 'individual' && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500 font-display text-lg text-broadcast-navy sm:h-12 sm:w-12 sm:text-xl">
            {entry.pilotNumber}
          </div>
        )}
        {/* leading-none + no overflow-hidden: display fonts clip under line-clamp */}
        <p
          className={`w-full max-w-full break-words font-display uppercase leading-none tracking-wide text-white ${style.nameSize}`}
        >
          {label}
        </p>
        {showCountry && (
          <div className="flex max-w-full items-center justify-center gap-2">
            {flagCode && <CountryFlag code={flagCode} size="sm" className="shrink-0" />}
            <p className="truncate text-xs uppercase tracking-[0.2em] text-sky-400/80 sm:text-sm">
              {countryLabel}
            </p>
          </div>
        )}
        {entry && (
          <p className="shrink-0 font-mono text-xl font-bold tabular-nums text-white sm:text-2xl md:text-3xl">
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
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-6 text-center sm:px-10">
        {competitionName && (
          <p className="mb-3 shrink-0 text-sm uppercase tracking-[0.4em] text-sky-400/60">
            {competitionName}
          </p>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="flex w-full flex-col items-center"
          >
            <p className="shrink-0 font-display text-4xl uppercase tracking-wide text-white sm:text-5xl md:text-6xl lg:text-7xl">
              {copy.title}
            </p>
            <p className="mt-3 shrink-0 text-base uppercase tracking-[0.35em] text-sky-400/80 sm:text-lg">
              {copy.subtitle}
            </p>

            <div className="mt-8 flex w-full max-w-5xl flex-col items-center justify-end gap-4 overflow-visible pb-2 sm:mt-10 sm:flex-row sm:items-end sm:justify-center sm:gap-6 md:gap-8">
              {PODIUM_ORDER.map((idx, order) =>
                podiumCard(top3[idx], PLACE_STYLES[idx], 0.12 + order * 0.08, category),
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      {/* Keep partners strip mounted — do not remount/fade with podium rotation */}
      <SponsorStrip />
    </div>
  );
}
