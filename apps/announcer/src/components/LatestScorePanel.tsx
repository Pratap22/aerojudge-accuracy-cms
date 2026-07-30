import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Minus, Target } from 'lucide-react';
import { ScoreDisplay } from '@npha/ui';
import type { LiveScoreEvent } from '../lib/types';
import type { PublicRankingRow } from '../lib/types';

interface LatestScorePanelProps {
  score: LiveScoreEvent | null;
  pilot: PublicRankingRow | null;
}

export function LatestScorePanel({ score, pilot }: LatestScorePanelProps) {
  const rankChange = score?.previousRank != null && score.rank > 0
    ? score.previousRank - score.rank
    : null;

  const displayScore = score?.scoreCm ?? null;
  const pilotName = pilot
    ? `${pilot.pilot.firstName} ${pilot.pilot.lastName}`
    : score?.pilotName ?? '—';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-xl border border-white/10 bg-tent-panel p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-[0.25em] text-sky-400">Latest Score</h3>
        {rankChange != null && rankChange !== 0 && (
          <div
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${
              rankChange > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {rankChange > 0 ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
            {Math.abs(rankChange)} place{Math.abs(rankChange) !== 1 ? 's' : ''}
          </div>
        )}
        {rankChange === 0 && (
          <div className="flex items-center gap-1 text-white/40">
            <Minus className="h-4 w-4" />
            <span className="text-sm">No change</span>
          </div>
        )}
      </div>

      {displayScore != null ? (
        <ScoreDisplay
          scoreCm={displayScore}
          isBullseye={score?.isBullseye || displayScore === 0}
          resultLabel={score?.resultLabel}
          pilotName={pilotName}
          pilotNumber={pilot?.pilot.pilotNumber}
          size="lg"
          className="border-white/10 bg-tent-navy/60"
        />
      ) : pilot ? (
        <div className="flex items-center gap-4 rounded-lg bg-tent-navy/60 p-6">
          <Target className="h-10 w-10 text-sky-400/50" />
          <div>
            <p className="text-lg font-semibold text-white">{pilotName}</p>
            <p className="text-sm text-white/50">Awaiting score…</p>
          </div>
        </div>
      ) : (
        <p className="py-8 text-center text-white/30">No scores yet</p>
      )}
    </motion.div>
  );
}
