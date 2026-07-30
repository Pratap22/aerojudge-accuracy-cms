import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_SPONSORS, type Sponsor } from '../lib/types';

interface SponsorStripProps {
  sponsors?: Sponsor[];
  variant?: 'strip' | 'full';
}

export function SponsorStrip({ sponsors = DEFAULT_SPONSORS, variant = 'strip' }: SponsorStripProps) {
  const items = sponsors.length > 0 ? sponsors : DEFAULT_SPONSORS;

  if (variant === 'full') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-12">
        <AnimatePresence mode="wait">
          {items.map((sponsor, index) => (
            <motion.div
              key={sponsor.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.15 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="flex h-24 w-48 items-center justify-center rounded-lg border border-sky-500/30 bg-broadcast-navy-light/80 px-6">
                <span className="font-display text-3xl tracking-wider text-white">{sponsor.name}</span>
              </div>
              {sponsor.tagline && (
                <span className="text-sm uppercase tracking-widest text-sky-300/70">{sponsor.tagline}</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-8 overflow-hidden border-t border-sky-500/20 bg-broadcast-navy-mid/90 px-8 py-3">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.3em] text-sky-400">Sponsors</span>
      <div className="flex flex-1 items-center justify-around gap-6">
        {items.map((sponsor) => (
          <motion.span
            key={sponsor.id}
            className="font-display text-lg tracking-wider text-white/80"
            whileHover={{ scale: 1.05, color: '#7dd3fc' }}
          >
            {sponsor.name}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
