import { motion } from 'framer-motion';

interface PreEventHeroLayoutProps {
  heroImageUrl?: string | null;
  /** Announced round waiting to start (usually Round 1). */
  nextRoundLabel?: string;
}

/**
 * Venue board when Round 1 has not started and there are no sponsors/officials
 * (or other pre-round screens) to rotate. Uses the event hero when present.
 */
export function PreEventHeroLayout({
  heroImageUrl,
  nextRoundLabel = 'Round 1',
}: PreEventHeroLayoutProps) {
  const hasHero = Boolean(heroImageUrl?.trim());

  return (
    <div className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden">
      {hasHero ? (
        <>
          <img
            src={heroImageUrl!}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-broadcast-navy via-broadcast-navy/55 to-broadcast-navy/40" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-broadcast-navy via-broadcast-navy-mid to-broadcast-navy-light" />
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center px-6 text-center"
      >
        <p className="font-display text-4xl uppercase tracking-wide text-white sm:text-6xl md:text-7xl">
          {nextRoundLabel}
        </p>
        <p className="mt-4 text-sm uppercase tracking-[0.25em] text-sky-300 sm:text-2xl">
          Has not started
        </p>
      </motion.div>
    </div>
  );
}
