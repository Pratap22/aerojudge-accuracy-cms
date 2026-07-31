import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import type { PublicRankingRow } from '../lib/types';
import { formatScore } from '../lib/utils';

interface ScoreBugProps {
  pilot: PublicRankingRow | null;
  liveScoreCm?: number | null;
  isBullseye?: boolean;
  resultLabel?: string;
  hasLastScore?: boolean;
  visible?: boolean;
}

export function ScoreBug({
  pilot,
  liveScoreCm,
  isBullseye = false,
  resultLabel,
  hasLastScore = false,
  visible = true,
}: ScoreBugProps) {
  if (!visible || !pilot?.pilot || !hasLastScore) return null;

  const score = liveScoreCm;
  const bullseye = isBullseye || score === 0;
  const nonMeasured = Boolean(resultLabel) || score == null;

  return (
    <motion.div
      key={`${pilot.id}-${score}-${resultLabel ?? ''}`}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="fixed right-8 top-8 z-40"
    >
      <div
        className={`rounded-xl border-2 px-6 py-4 backdrop-blur-sm ${
          bullseye && !nonMeasured
            ? 'border-emerald-400/60 bg-emerald-500/20'
            : 'border-sky-500/40 bg-broadcast-navy/90'
        }`}
      >
        <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-sky-400/70">Last Score</p>
        <div className="flex items-center gap-3">
          <span className="font-display text-xl text-sky-400">#{pilot.pilot.pilotNumber}</span>
          <div className="text-right">
            {nonMeasured ? (
              <span className="font-display text-3xl font-bold uppercase text-amber-300">
                {resultLabel ?? '—'}
              </span>
            ) : (
              <div className="flex items-baseline gap-1">
                {bullseye && <Target className="mr-1 h-5 w-5 text-emerald-400" />}
                <span
                  className={`font-mono text-4xl font-bold tabular-nums ${
                    bullseye ? 'text-emerald-400' : 'text-white'
                  }`}
                >
                  {formatScore(score)}
                </span>
                <span className="text-lg text-sky-400">cm</span>
              </div>
            )}
            {pilot.rank > 0 && (
              <p className="text-xs uppercase tracking-wider text-sky-400/70">Rank #{pilot.rank}</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
