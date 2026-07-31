import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSponsors } from '../hooks/useCompetition';

export function SponsorsLayout() {
  const { data: sponsors = [], isLoading } = useSponsors();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % sponsors.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [sponsors.length]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sky-400/60">Loading sponsors…</p>
      </div>
    );
  }

  if (sponsors.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-broadcast-navy via-broadcast-navy-mid to-broadcast-navy-light p-16">
        <p className="font-display text-3xl uppercase tracking-[0.3em] text-sky-400/50">
          No sponsors configured
        </p>
      </div>
    );
  }

  const current = sponsors[index % sponsors.length];
  if (!current) return null;

  return (
    <div className="relative flex h-full items-center justify-center bg-gradient-to-br from-broadcast-navy via-broadcast-navy-mid to-broadcast-navy-light p-16">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, scale: 0.9, x: 40 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 1.05, x: -40 }}
          transition={{ duration: 0.55 }}
          className="text-center"
        >
          <p className="mb-6 text-sm uppercase tracking-[0.4em] text-sky-400/70">
            {current.type ?? 'Sponsor'}
          </p>
          <div className="mx-auto mb-8 flex h-44 w-[28rem] max-w-[90vw] items-center justify-center rounded-2xl border-2 border-sky-500/40 bg-broadcast-navy-light/80 px-8">
            {current.logoUrl ? (
              <img
                src={current.logoUrl}
                alt={current.name}
                className="max-h-36 max-w-full object-contain"
              />
            ) : (
              <span className="font-display text-5xl tracking-wider text-white sm:text-6xl">
                {current.name}
              </span>
            )}
          </div>
          <p className="font-display text-3xl uppercase tracking-wide text-white">{current.name}</p>
        </motion.div>
      </AnimatePresence>
      <div className="absolute bottom-12 flex gap-2">
        {sponsors.map((s, i) => (
          <div
            key={s.id}
            className={`h-2 w-2 rounded-full transition-colors ${
              i === index ? 'bg-sky-400' : 'bg-sky-500/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
