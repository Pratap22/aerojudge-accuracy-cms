import { motion, AnimatePresence } from 'framer-motion';
import type { PublicRankingRow } from '../lib/types';
import { countryCodeToEmoji } from '../lib/utils';

interface LowerThirdProps {
  pilot: PublicRankingRow | null;
  visible?: boolean;
  /** When true, label as last scored rather than now flying */
  fromLastScore?: boolean;
}

export function LowerThird({ pilot, visible = true, fromLastScore = false }: LowerThirdProps) {
  if (!visible || !pilot?.pilot) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={pilot.id}
        initial={{ x: -400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -400, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        className="fixed bottom-24 left-8 z-40"
      >
        <div className="flex items-stretch overflow-hidden rounded-r-lg shadow-2xl">
          <div className="flex w-2 bg-sky-500" />
          <div className="bg-gradient-to-r from-broadcast-navy/95 to-broadcast-navy/80 px-6 py-4 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 font-display text-2xl text-broadcast-navy">
                {pilot.pilot.pilotNumber}
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sky-400">
                  {fromLastScore ? 'Last Scored' : 'Now Flying'}
                </p>
                <h2 className="font-display text-3xl uppercase tracking-wide text-white">
                  {pilot.pilot.firstName} {pilot.pilot.lastName}
                </h2>
                <p className="text-sm text-sky-300">
                  {countryCodeToEmoji(pilot.pilot.country?.code ?? '')}{' '}
                  {pilot.pilot.country?.name ?? '—'}
                  {pilot.rank > 0 ? ` · Rank #${pilot.rank}` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
