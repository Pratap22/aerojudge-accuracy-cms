import { motion } from 'framer-motion';
import { RankBadge } from '@npha/ui';
import type { LeaderboardEntry } from '@npha/ui';
import { formatScore } from '../lib/utils';

interface AnimatedLeaderboardProps {
  entries: LeaderboardEntry[];
  title: string;
  maxRows?: number;
  highlightPilotNumber?: number;
}

export function AnimatedLeaderboard({
  entries,
  title,
  maxRows = 10,
  highlightPilotNumber,
}: AnimatedLeaderboardProps) {
  const rows = entries.slice(0, maxRows);

  return (
    <div className="flex h-full flex-col">
      <motion.h2
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="mb-8 font-display text-5xl uppercase tracking-[0.15em] text-sky-400"
      >
        {title}
      </motion.h2>

      <div className="flex-1 space-y-2">
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
