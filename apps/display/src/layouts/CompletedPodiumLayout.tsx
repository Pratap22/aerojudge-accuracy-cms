import { motion, AnimatePresence } from 'framer-motion';
import type { LeaderboardEntry } from '@aero-judge/ui';
import { CountryFlag } from '../components/CountryFlag';
import { SponsorStrip } from '../components/SponsorStrip';
import { formatScore } from '../lib/utils';
import { padPilotNumber } from '@aero-judge/utils';

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
    height: 'min-h-48 sm:min-h-80 md:min-h-[22rem]',
    /** Phones: three columns side by side; 1st gets the widest share */
    width: 'min-w-0 flex-[1.25] sm:w-full sm:flex-none sm:max-w-[min(340px,40vh)]',
    nameSize: 'text-sm sm:text-2xl md:text-3xl',
  },
  {
    place: '2nd',
    ring: 'border-slate-300/50 bg-slate-400/10',
    accent: 'text-slate-200',
    height: 'min-h-44 sm:min-h-72 md:min-h-80',
    width: 'min-w-0 flex-1 sm:w-full sm:flex-none sm:max-w-[min(300px,35vh)]',
    nameSize: 'text-xs sm:text-xl md:text-2xl',
  },
  {
    place: '3rd',
    ring: 'border-orange-700/50 bg-orange-800/15',
    accent: 'text-orange-300',
    height: 'min-h-40 sm:min-h-64 md:min-h-72',
    width: 'min-w-0 flex-1 sm:w-full sm:flex-none sm:max-w-[min(280px,32vh)]',
    nameSize: 'text-xs sm:text-lg md:text-xl',
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

  const flagCode =
    entry?.countryCode2 &&
    entry.countryCode2.length === 2 &&
    entry.countryCode2 !== 'XX' &&
    /^[A-Z]{2}$/.test(entry.countryCode2)
      ? entry.countryCode2
      : null;
  const countryLabel = entry?.countryCode?.trim() || undefined;
  const showCountry = Boolean(countryLabel);

  if (entry && category === 'individual' && !entry.hideNumber) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, type: 'spring', stiffness: 110 }}
        className={`flex flex-col justify-end sm:shrink-0 ${style.width}`}
      >
        <div className={`w-full overflow-hidden rounded-xl border sm:rounded-2xl ${style.ring}`}>
          <div className="relative aspect-square w-full bg-broadcast-navy">
            {entry.photoUrl ? (
              <img
                src={entry.photoUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-broadcast-navy-light to-broadcast-navy-mid">
                <span className="font-display text-3xl text-sky-400 sm:text-6xl md:text-7xl">
                  {padPilotNumber(entry.pilotNumber)}
                </span>
              </div>
            )}
            <div className="absolute inset-x-1.5 top-1.5 flex items-start justify-between gap-1 sm:inset-x-3 sm:top-3 sm:gap-2">
              <span
                className={`rounded-md bg-black/65 px-1.5 py-0.5 font-display text-xs uppercase leading-tight tracking-[0.15em] backdrop-blur-sm sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-lg sm:tracking-[0.2em] md:text-xl ${style.accent}`}
              >
                {style.place}
              </span>
              <span className="rounded-md bg-black/65 px-1.5 py-0.5 font-display text-xs leading-tight text-white backdrop-blur-sm sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-lg md:text-xl">
                #{padPilotNumber(entry.pilotNumber)}
              </span>
            </div>
            {flagCode ? (
              <span className="absolute bottom-1.5 right-1.5 inline-flex items-center rounded-md bg-black/65 px-1 py-0.5 backdrop-blur-sm sm:bottom-3 sm:right-3 sm:rounded-lg sm:px-2 sm:py-1.5">
                <CountryFlag code={flagCode} size="sm" />
              </span>
            ) : null}
          </div>
          <div className="flex flex-col items-center gap-1 px-1.5 py-2 text-center sm:gap-2 sm:px-3 sm:py-3">
            <p className="font-mono text-base font-bold tabular-nums leading-none text-white sm:text-2xl md:text-3xl">
              {formatScore(entry.totalScoreCm)}
              <span className="ml-0.5 text-[10px] text-sky-400 sm:ml-1 sm:text-base">cm</span>
            </p>
            {/* leading-tight + no overflow-hidden: display fonts clip under line-clamp */}
            <p
              className={`w-full break-words font-display uppercase leading-tight tracking-wide text-white ${style.nameSize}`}
            >
              {label}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 48 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 110 }}
      className={`flex flex-col justify-end sm:shrink-0 ${style.width}`}
    >
      <div
        className={`flex ${style.height} w-full flex-col items-center justify-center gap-2 rounded-xl border px-2 py-4 text-center sm:gap-3 sm:rounded-2xl sm:px-5 sm:py-6 ${style.ring}`}
      >
        <p className={`shrink-0 font-display text-xl uppercase tracking-[0.2em] sm:text-4xl ${style.accent}`}>
          {style.place}
        </p>
        {entry && !entry.hideNumber && category === 'individual' && (
          <div className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-sky-500 px-1 font-mono text-xs font-bold tabular-nums text-broadcast-navy sm:h-12 sm:min-w-12 sm:text-sm">
            {padPilotNumber(entry.pilotNumber)}
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
          <p className="shrink-0 font-mono text-base font-bold tabular-nums text-white sm:text-2xl md:text-3xl">
            {formatScore(entry.totalScoreCm)}
            <span className="ml-0.5 text-[10px] text-sky-400 sm:ml-1 sm:text-base">cm</span>
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
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-3 text-center sm:px-10">
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

            <div className="mt-6 flex w-full max-w-5xl flex-row items-end justify-center gap-2 overflow-visible pb-2 sm:mt-10 sm:gap-6 md:gap-8">
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
