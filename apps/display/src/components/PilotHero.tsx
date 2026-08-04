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
      <div className="col-span-7 flex min-h-0 min-w-0 flex-col justify-center gap-5 overflow-hidden pl-1 xl:gap-6 xl:pl-2">
        {competitionName && (
          <p className="shrink-0 truncate text-lg font-medium uppercase tracking-[0.28em] text-sky-400/80 sm:text-xl xl:text-2xl">
            {competitionName}
          </p>
        )}
        <motion.h1
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="shrink-0 font-display text-[clamp(2.75rem,6.5vw,6.5rem)] uppercase leading-[1.05] tracking-wide text-white"
        >
          {name}
        </motion.h1>
        <p className="shrink-0 text-2xl font-medium text-sky-300 sm:text-3xl xl:text-4xl">
          {pilot.pilot.country?.name ?? pilot.pilot.nationality ?? '—'}
        </p>

        <div className="flex shrink-0 flex-wrap items-end gap-x-10 gap-y-4 xl:gap-x-12">
          <div className="min-w-0">
            <p className="mb-1.5 text-base font-semibold uppercase tracking-[0.2em] text-sky-400/90 sm:text-lg xl:text-xl">
              Round
            </p>
            <p className="font-display text-5xl leading-none text-white sm:text-6xl xl:text-7xl">{roundNumber}</p>
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-base font-semibold uppercase tracking-[0.2em] text-sky-400/90 sm:text-lg xl:text-xl">
              Overall Rank
            </p>
            <p className="font-display text-5xl leading-none text-broadcast-amber sm:text-6xl xl:text-7xl">
              #{pilot.rank}
            </p>
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-base font-semibold uppercase tracking-[0.2em] text-sky-400/90 sm:text-lg xl:text-xl">
              Total
            </p>
            <p className="font-mono text-4xl font-bold leading-none text-white sm:text-5xl xl:text-6xl">
              {formatScore(pilot.totalScoreCm)}{' '}
              <span className="text-2xl font-semibold text-sky-400 sm:text-3xl xl:text-4xl">cm</span>
            </p>
          </div>
        </div>

        <div className="min-h-0 min-w-0 shrink">
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
                  ? 'overflow-hidden rounded-xl border-2 border-emerald-400/50 bg-emerald-500/10 px-6 py-7 xl:px-10 xl:py-9'
                  : 'overflow-hidden rounded-xl border border-sky-500/30 bg-broadcast-navy-light/80 px-6 py-7 xl:px-10 xl:py-9'
              }
            >
              {resultLabel ? (
                <p className="text-center font-display text-[clamp(2.5rem,6vw,5.5rem)] uppercase leading-none tracking-[0.1em] text-sky-100">
                  {resultLabel}
                </p>
              ) : (
                <p className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 leading-none">
                  <span
                    className={
                      bullseye
                        ? 'font-mono text-[clamp(3.5rem,9vw,7rem)] font-bold tabular-nums tracking-tight text-emerald-400'
                        : 'font-mono text-[clamp(3.5rem,9vw,7rem)] font-bold tabular-nums tracking-tight text-white'
                    }
                  >
                    {formatScore(liveScoreCm ?? 0)}
                  </span>
                  <span className="text-[clamp(1.25rem,2.5vw,2.25rem)] font-semibold text-sky-300">cm</span>
                </p>
              )}
              {bullseye && !resultLabel ? (
                <p className="mt-4 text-center text-base font-semibold uppercase tracking-[0.2em] text-emerald-400 xl:text-lg">
                  Bullseye
                </p>
              ) : null}
            </motion.div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-dashed border-sky-500/25 bg-broadcast-navy-light/40 px-6 py-10 text-center xl:px-8 xl:py-12">
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
