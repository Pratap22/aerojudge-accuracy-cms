import { motion } from 'framer-motion';
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
  const bullseye = isBullseye || liveScoreCm === 0;

  return (
    <div className="grid h-full min-h-0 grid-cols-12 gap-6 xl:gap-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="col-span-5 flex min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-broadcast-navy-light to-broadcast-navy-mid p-6 xl:p-8"
      >
        <div className="mb-4 flex aspect-square w-[min(12rem,42%)] max-h-48 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-sky-500/30 bg-broadcast-navy xl:mb-6 xl:max-h-56 xl:w-[min(14rem,48%)]">
          {pilot.pilot.photoUrl ? (
            <img
              src={pilot.pilot.photoUrl}
              alt=""
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <span className="font-display text-6xl text-sky-400 xl:text-8xl">{pilot.pilot.pilotNumber}</span>
          )}
        </div>
        {pilot.pilot.photoUrl ? (
          <p className="mb-3 font-display text-xl text-sky-400 xl:mb-4 xl:text-2xl">
            #{pilot.pilot.pilotNumber}
          </p>
        ) : null}
        <CountryFlag code={pilot.pilot.country?.code2 ?? pilot.pilot.country?.code ?? 'XX'} size="lg" />
      </motion.div>

      {/* Right panel — oversized type for LED / LED-wall readability */}
      <div className="col-span-7 flex min-h-0 min-w-0 flex-col justify-center gap-4 overflow-y-auto pl-1 xl:gap-5 xl:pl-2">
        {competitionName && (
          <p className="shrink-0 truncate text-base font-medium uppercase tracking-[0.28em] text-sky-400/80 sm:text-lg xl:text-xl">
            {competitionName}
          </p>
        )}
        <motion.h1
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="shrink-0 font-display text-[clamp(2.5rem,5.5vw,5.5rem)] uppercase leading-[1.05] tracking-wide text-white"
        >
          {name}
        </motion.h1>
        <p className="shrink-0 text-xl font-medium text-sky-300 sm:text-2xl xl:text-3xl">
          {pilot.pilot.country?.name ?? pilot.pilot.nationality ?? '—'}
        </p>

        <div className="flex shrink-0 flex-wrap items-end gap-x-10 gap-y-4 xl:gap-x-12">
          <div className="min-w-0">
            <p className="mb-1.5 text-sm font-semibold uppercase tracking-[0.2em] text-sky-400/90 sm:text-base xl:text-lg">
              Round
            </p>
            <p className="font-display text-4xl leading-none text-white sm:text-5xl xl:text-6xl">{roundNumber}</p>
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-sm font-semibold uppercase tracking-[0.2em] text-sky-400/90 sm:text-base xl:text-lg">
              Overall Rank
            </p>
            <p className="font-display text-4xl leading-none text-broadcast-amber sm:text-5xl xl:text-6xl">
              #{pilot.rank}
            </p>
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-sm font-semibold uppercase tracking-[0.2em] text-sky-400/90 sm:text-base xl:text-lg">
              Total
            </p>
            <p className="font-mono text-3xl font-bold leading-none tracking-tighter text-white sm:text-4xl xl:text-5xl">
              {formatScore(pilot.totalScoreCm)}{' '}
              <span className="text-xl font-semibold text-sky-400 sm:text-2xl xl:text-3xl">cm</span>
            </p>
          </div>
        </div>

        <div className="min-w-0 shrink-0">
          <p className="mb-3 text-base font-semibold uppercase tracking-[0.22em] text-sky-400/90 sm:text-lg xl:text-xl">
            Last Score
          </p>
          {showScore ? (
            <motion.div
              key={`${liveScoreCm}-${resultLabel ?? ''}-${isBullseye}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={
                bullseye && !resultLabel
                  ? 'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-emerald-400/50 bg-emerald-500/10 px-8 py-6 sm:gap-4 sm:py-7 xl:px-12 xl:py-8'
                  : 'flex flex-col items-center justify-center rounded-xl border border-sky-500/30 bg-broadcast-navy-light/80 px-8 py-6 sm:py-7 xl:px-12 xl:py-8'
              }
            >
              {resultLabel ? (
                <p className="text-center font-display text-[clamp(2.25rem,5.5vw,4.5rem)] uppercase leading-none tracking-[0.1em] text-sky-100">
                  {resultLabel}
                </p>
              ) : (
                <div className="flex items-baseline justify-center gap-x-2 sm:gap-x-3">
                  <span
                    className={
                      bullseye
                        ? 'font-mono text-[clamp(3rem,7.5vw,5.5rem)] font-bold tabular-nums leading-none tracking-tighter text-emerald-400'
                        : 'font-mono text-[clamp(3rem,7.5vw,5.5rem)] font-bold tabular-nums leading-none tracking-tighter text-white'
                    }
                  >
                    {formatScore(liveScoreCm ?? 0)}
                  </span>
                  <span
                    className={
                      bullseye
                        ? 'text-[clamp(1.125rem,2.2vw,1.75rem)] font-semibold leading-none text-emerald-400/90'
                        : 'text-[clamp(1.125rem,2.2vw,1.75rem)] font-semibold leading-none text-sky-300'
                    }
                  >
                    cm
                  </span>
                </div>
              )}
              {bullseye && !resultLabel ? (
                <p className="text-center text-sm font-semibold uppercase tracking-[0.28em] text-emerald-400 sm:text-base">
                  Bullseye
                </p>
              ) : null}
            </motion.div>
          ) : (
            <div className="rounded-xl border border-dashed border-sky-500/25 bg-broadcast-navy-light/40 px-6 py-8 text-center xl:px-8 xl:py-10">
              <p className="font-display text-2xl uppercase tracking-[0.12em] text-sky-300/80 sm:text-3xl xl:text-4xl">
                Waiting for judge…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
