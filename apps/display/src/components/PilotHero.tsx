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
      <div className="flex h-full items-center justify-center px-4">
        <motion.p
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="font-display text-2xl uppercase tracking-widest text-sky-400/60 sm:text-4xl"
        >
          Awaiting pilot…
        </motion.p>
      </div>
    );
  }

  const name = pilotFullName(pilot.pilot.firstName, pilot.pilot.lastName);
  const showScore = hasLastScore || liveScoreCm != null || Boolean(resultLabel);
  const bullseye = isBullseye || liveScoreCm === 0;
  const countryLabel = pilot.pilot.country?.name ?? pilot.pilot.nationality ?? '—';
  const flagCode = pilot.pilot.country?.code2 ?? pilot.pilot.country?.code ?? 'XX';

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain md:grid md:grid-cols-12 md:gap-6 md:overflow-hidden xl:gap-10">
      {/* Photo / number — horizontal strip on mobile, tall panel on desktop */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex shrink-0 flex-row items-center gap-3 rounded-xl border border-sky-500/20 bg-gradient-to-br from-broadcast-navy-light to-broadcast-navy-mid p-3 sm:gap-4 sm:rounded-2xl sm:p-4 md:col-span-5 md:h-full md:min-h-0 md:flex-col md:items-center md:justify-center md:overflow-hidden md:p-6 xl:p-8"
      >
        <div className="flex aspect-square w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-sky-500/30 bg-broadcast-navy sm:w-20 sm:border-4 md:mb-4 md:w-[min(12rem,42%)] md:max-h-48 md:border-4 xl:mb-6 xl:max-h-56 xl:w-[min(14rem,48%)]">
          {pilot.pilot.photoUrl ? (
            <img
              src={pilot.pilot.photoUrl}
              alt=""
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <span className="font-display text-3xl text-sky-400 sm:text-4xl md:text-6xl xl:text-8xl">
              {pilot.pilot.pilotNumber}
            </span>
          )}
        </div>
        {pilot.pilot.photoUrl ? (
          <p className="font-display text-lg text-sky-400 md:mb-3 md:text-xl xl:mb-4 xl:text-2xl">
            #{pilot.pilot.pilotNumber}
          </p>
        ) : null}
        <div className="min-w-0 flex-1 md:hidden">
          <p className="truncate font-display text-xl uppercase leading-tight tracking-wide text-white sm:text-2xl">
            {name}
          </p>
          <p className="mt-0.5 truncate text-sm text-sky-300">{countryLabel}</p>
        </div>
        <CountryFlag code={flagCode} size="md" className="shrink-0 md:hidden" />
        <CountryFlag code={flagCode} size="lg" className="mt-2 hidden md:block" />
      </motion.div>

      {/* Stats — full width under media on mobile */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-start gap-3 sm:gap-4 md:col-span-7 md:justify-center md:overflow-y-auto md:pl-1 xl:gap-5 xl:pl-2">
        {competitionName && (
          <p className="hidden shrink-0 truncate text-base font-medium uppercase tracking-[0.28em] text-sky-400/80 md:block md:text-lg xl:text-xl">
            {competitionName}
          </p>
        )}
        <motion.h1
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="hidden shrink-0 font-display uppercase leading-[1.05] tracking-wide text-white md:block md:text-[clamp(2.25rem,5vw,5.5rem)]"
        >
          {name}
        </motion.h1>
        <p className="hidden shrink-0 text-xl font-medium text-sky-300 md:block xl:text-3xl">
          {countryLabel}
        </p>

        <div className="grid shrink-0 grid-cols-3 gap-2 sm:gap-4 md:flex md:flex-wrap md:items-end md:gap-x-10 md:gap-y-4 xl:gap-x-12">
          <div className="min-w-0 rounded-lg bg-broadcast-navy-light/40 px-2 py-2 text-center sm:px-3 md:rounded-none md:bg-transparent md:px-0 md:py-0 md:text-left">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-400/90 sm:text-xs md:mb-1.5 md:text-sm md:tracking-[0.2em] xl:text-lg">
              Round
            </p>
            <p className="font-display text-2xl leading-none text-white sm:text-3xl md:text-5xl xl:text-6xl">
              {roundNumber}
            </p>
          </div>
          <div className="min-w-0 rounded-lg bg-broadcast-navy-light/40 px-2 py-2 text-center sm:px-3 md:rounded-none md:bg-transparent md:px-0 md:py-0 md:text-left">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-400/90 sm:text-xs md:mb-1.5 md:text-sm md:tracking-[0.2em] xl:text-lg">
              Rank
            </p>
            <p className="font-display text-2xl leading-none text-broadcast-amber sm:text-3xl md:text-5xl xl:text-6xl">
              #{pilot.rank}
            </p>
          </div>
          <div className="min-w-0 rounded-lg bg-broadcast-navy-light/40 px-2 py-2 text-center sm:px-3 md:rounded-none md:bg-transparent md:px-0 md:py-0 md:text-left">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-400/90 sm:text-xs md:mb-1.5 md:text-sm md:tracking-[0.2em] xl:text-lg">
              Total
            </p>
            <p className="font-mono text-xl font-bold leading-none tracking-tighter text-white sm:text-2xl md:text-4xl xl:text-5xl">
              {formatScore(pilot.totalScoreCm)}{' '}
              <span className="text-sm font-semibold text-sky-400 sm:text-base md:text-2xl xl:text-3xl">
                cm
              </span>
            </p>
          </div>
        </div>

        <div className="min-w-0 shrink-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90 sm:mb-3 sm:text-base md:text-lg xl:text-xl">
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
                  ? 'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-emerald-400/50 bg-emerald-500/10 px-4 py-4 sm:gap-3 sm:px-8 sm:py-6 xl:px-12 xl:py-8'
                  : 'flex flex-col items-center justify-center rounded-xl border border-sky-500/30 bg-broadcast-navy-light/80 px-4 py-4 sm:px-8 sm:py-6 xl:px-12 xl:py-8'
              }
            >
              {resultLabel ? (
                <p className="text-center font-display text-[clamp(1.75rem,8vw,4.5rem)] uppercase leading-none tracking-[0.1em] text-sky-100">
                  {resultLabel}
                </p>
              ) : (
                <div className="flex items-baseline justify-center gap-x-2 sm:gap-x-3">
                  <span
                    className={
                      bullseye
                        ? 'font-mono text-[clamp(2.5rem,12vw,5.5rem)] font-bold tabular-nums leading-none tracking-tighter text-emerald-400'
                        : 'font-mono text-[clamp(2.5rem,12vw,5.5rem)] font-bold tabular-nums leading-none tracking-tighter text-white'
                    }
                  >
                    {formatScore(liveScoreCm ?? 0)}
                  </span>
                  <span
                    className={
                      bullseye
                        ? 'text-[clamp(1rem,3vw,1.75rem)] font-semibold leading-none text-emerald-400/90'
                        : 'text-[clamp(1rem,3vw,1.75rem)] font-semibold leading-none text-sky-300'
                    }
                  >
                    cm
                  </span>
                </div>
              )}
              {bullseye && !resultLabel ? (
                <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-emerald-400 sm:text-sm md:text-base">
                  Bullseye
                </p>
              ) : null}
            </motion.div>
          ) : (
            <div className="rounded-xl border border-dashed border-sky-500/25 bg-broadcast-navy-light/40 px-4 py-5 text-center sm:px-6 sm:py-8 xl:px-8 xl:py-10">
              <p className="font-display text-lg uppercase tracking-[0.12em] text-sky-300/80 sm:text-2xl md:text-3xl xl:text-4xl">
                Waiting for judge…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
