import { motion } from 'framer-motion';
import { SponsorStrip } from '../components/SponsorStrip';

interface RoundClosedLayoutProps {
  closedRoundNumber: number;
  nextRoundNumber: number;
  competitionName?: string;
}

/** Full-screen interstitial — not mixed with pilot scoring UI. */
export function RoundClosedLayout({
  closedRoundNumber,
  nextRoundNumber,
  competitionName,
}: RoundClosedLayoutProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
        {competitionName && (
          <p className="mb-8 text-sm uppercase tracking-[0.4em] text-sky-400/60">{competitionName}</p>
        )}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-6xl uppercase tracking-wide text-white sm:text-7xl md:text-8xl"
        >
          Round {closedRoundNumber} closed
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mt-10 border-t border-sky-500/30 pt-10"
        >
          <p className="text-sm uppercase tracking-[0.35em] text-sky-400/70">Up next</p>
          <p className="mt-3 font-display text-5xl uppercase tracking-wide text-sky-300 sm:text-6xl">
            R{nextRoundNumber}
          </p>
          <motion.p
            animate={{ opacity: [0.55, 1, 0.55] }}
            transition={{ repeat: Infinity, duration: 2.4 }}
            className="mt-4 text-2xl uppercase tracking-[0.25em] text-sky-400/80"
          >
            Starting soon
          </motion.p>
        </motion.div>
      </div>
      <SponsorStrip />
    </div>
  );
}
