import { motion } from 'framer-motion';
import { SponsorStrip } from '../components/SponsorStrip';

interface RoundAwaitingLayoutProps {
  roundNumber: number;
  competitionName?: string;
}

/** Full-screen interstitial when a round is live but no scores yet. */
export function RoundAwaitingLayout({ roundNumber, competitionName }: RoundAwaitingLayoutProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center sm:px-10">
        {competitionName && (
          <p className="mb-4 line-clamp-2 max-w-xl text-xs uppercase tracking-[0.3em] text-sky-400/60 sm:mb-8 sm:line-clamp-1 sm:text-sm sm:tracking-[0.4em]">
            {competitionName}
          </p>
        )}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-4xl uppercase tracking-wide text-white sm:text-7xl md:text-8xl"
        >
          Round {roundNumber}
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ delay: 0.1, repeat: Infinity, duration: 2.4 }}
          className="mt-4 text-base uppercase tracking-[0.25em] text-sky-300 sm:mt-8 sm:text-3xl sm:tracking-[0.3em]"
        >
          Waiting for first score
        </motion.p>
      </div>
      <SponsorStrip />
    </div>
  );
}
