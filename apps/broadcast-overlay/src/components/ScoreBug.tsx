import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import type { PublicRankingRow } from '../lib/types';
import { formatScore } from '../lib/utils';

interface ScoreBugProps {
  pilot: PublicRankingRow | null;
  liveScoreCm?: number | null;
  isBullseye?: boolean;
  visible?: boolean;
}

export function ScoreBug({ pilot, liveScoreCm, isBullseye = false, visible = true }: ScoreBugProps) {
  if (!visible || !pilot) return null;

  const score = liveScoreCm ?? pilot.totalScoreCm;
  const bullseye = isBullseye || score === 0;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="fixed right-8 top-8 z-40"
    >
      <div
        className={`rounded-xl border-2 px-6 py-4 backdrop-blur-sm ${
          bullseye
            ? 'border-emerald-400/60 bg-emerald-500/20'
            : 'border-sky-500/40 bg-broadcast-navy/90'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="font-display text-xl text-sky-400">#{pilot.pilot.pilotNumber}</span>
          <div className="text-right">
            <div className="flex items-baseline gap-1">
              {bullseye && <Target className="mr-1 h-5 w-5 text-emerald-400" />}
              <span className={`font-mono text-4xl font-bold tabular-nums ${bullseye ? 'text-emerald-400' : 'text-white'}`}>
                {formatScore(score)}
              </span>
              <span className="text-lg text-sky-400">cm</span>
            </div>
            <p className="text-xs uppercase tracking-wider text-sky-400/70">Rank #{pilot.rank}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
