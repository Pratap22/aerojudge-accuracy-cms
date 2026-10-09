import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { RankBadge } from '@aero-judge/ui';
import type { LeaderboardEntry } from '@aero-judge/ui';
import { formatScore, getAutoInterval } from '../lib/utils';

interface AnimatedLeaderboardProps {
  entries: LeaderboardEntry[];
  title: string;
  maxRows?: number;
  highlightPilotNumber?: number;
  /** In auto rotation, finish one scroll through an overflowing list before the next screen. */
  autoAdvance?: boolean;
  onAutoAdvance?: () => void;
}

function wait(ms: number, isCancelled: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const id = window.setTimeout(() => resolve(), ms);
    const poll = window.setInterval(() => {
      if (!isCancelled()) return;
      window.clearTimeout(id);
      window.clearInterval(poll);
      resolve();
    }, 40);
    window.setTimeout(() => window.clearInterval(poll), ms + 50);
  });
}

/** Gentle ease so the list starts and stops softly without speeding through the middle. */
function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function animateScroll(
  el: HTMLElement,
  to: number,
  duration: number,
  isCancelled: () => boolean,
): Promise<void> {
  return new Promise((resolve) => {
    const from = el.scrollTop;
    const start = performance.now();
    const step = (now: number) => {
      if (isCancelled()) {
        resolve();
        return;
      }
      const t = Math.min(1, (now - start) / duration);
      el.scrollTop = from + (to - from) * easeInOutSine(t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

/** About one row every few seconds, long enough to read names on a venue screen. */
function scrollDurationMs(distancePx: number): number {
  const pixelsPerSecond = 14;
  return Math.min(50000, Math.max(12000, (distancePx / pixelsPerSecond) * 1000));
}

export function AnimatedLeaderboard({
  entries,
  title,
  maxRows = 10,
  highlightPilotNumber,
  autoAdvance = false,
  onAutoAdvance,
}: AnimatedLeaderboardProps) {
  const rows = entries.slice(0, maxRows);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const onAutoAdvanceRef = useRef(onAutoAdvance);
  onAutoAdvanceRef.current = onAutoAdvance;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let cancelled = false;
    const isCancelled = () => cancelled;
    const run = async (loop: boolean) => {
      el.scrollTop = 0;
      await wait(2800, isCancelled);
      if (isCancelled()) return;
      const overflow = el.scrollHeight - el.clientHeight;
      if (overflow <= 8) {
        if (!autoAdvance) return;
        await wait(Math.max(0, getAutoInterval() * 1000 - 2800), isCancelled);
        if (!isCancelled()) onAutoAdvanceRef.current?.();
        return;
      }

      const scrollMs = scrollDurationMs(overflow);
      await animateScroll(el, overflow, scrollMs, isCancelled);
      if (isCancelled()) return;
      await wait(3200, isCancelled);
      if (isCancelled()) return;

      if (autoAdvance) {
        onAutoAdvanceRef.current?.();
        return;
      }

      if (!loop) return;
      await animateScroll(el, 0, scrollMs, isCancelled);
      if (!isCancelled()) void run(true);
    };

    void run(!autoAdvance);
    return () => {
      cancelled = true;
    };
  }, [autoAdvance, rows.length, title]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <motion.h2
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="mb-6 shrink-0 font-display text-4xl uppercase tracking-[0.15em] text-sky-400 sm:mb-8 sm:text-5xl"
      >
        {title}
      </motion.h2>

      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {rows.length === 0 ? (
          <p className="text-xl text-sky-400/50">No rankings yet</p>
        ) : (
          rows.map((entry, index) => {
            const label =
              entry.displayName ??
              `${entry.firstName}${entry.lastName ? ` ${entry.lastName}` : ''}`.trim();
            const isHighlighted =
              !entry.hideNumber && entry.pilotNumber === highlightPilotNumber;
            return (
              <motion.div
                key={`${entry.rank}-${entry.pilotNumber}-${label}`}
                initial={{ x: -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.08, type: 'spring', stiffness: 120 }}
                className={`flex items-center gap-6 rounded-lg px-6 py-4 ${
                  isHighlighted
                    ? 'border border-sky-400/50 bg-sky-500/10'
                    : entry.rank <= 3
                      ? 'bg-broadcast-navy-light/60'
                      : 'bg-broadcast-navy-mid/40'
                }`}
              >
                <RankBadge rank={entry.rank} size="lg" className="shrink-0" />
                {!entry.hideNumber && (
                  entry.photoUrl ? (
                    <img
                      src={entry.photoUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-full object-cover object-top ring-2 ring-sky-500/40"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-500 font-display text-xl text-broadcast-navy">
                      {entry.pilotNumber}
                    </div>
                  )
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-2xl font-semibold text-white">
                    {!entry.hideNumber && entry.photoUrl ? (
                      <span className="mr-2 font-mono text-lg text-sky-400">#{entry.pilotNumber}</span>
                    ) : null}
                    {label}
                  </p>
                  {entry.countryCode2 && entry.countryCode2 !== 'XX' && (
                    <p className="text-sm uppercase tracking-wider text-sky-400/70">
                      {entry.countryCode2}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-mono text-3xl font-bold tabular-nums text-white">
                    {formatScore(entry.totalScoreCm)}
                    <span className="ml-1 text-lg text-sky-400">cm</span>
                  </p>
                  {entry.bullseyes != null && entry.bullseyes > 0 && (
                    <p className="text-sm text-emerald-400">
                      {entry.bullseyes} bullseye{entry.bullseyes !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
