import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { DEFAULT_SPONSORS } from '../lib/types';

export function SponsorsLayout() {
  const [index, setIndex] = useState(0);
  const sponsors = DEFAULT_SPONSORS;

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % sponsors.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [sponsors.length]);

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
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="mb-8 mx-auto flex h-40 w-80 items-center justify-center rounded-2xl border-2 border-sky-500/40 bg-broadcast-navy-light/80">
            <span className="font-display text-6xl tracking-wider text-white">{current.name}</span>
          </div>
          {current.tagline && (
            <p className="text-2xl uppercase tracking-[0.3em] text-sky-300">{current.tagline}</p>
          )}
        </motion.div>
      </AnimatePresence>
      <div className="absolute bottom-12 flex gap-2">
        {sponsors.map((s, i) => (
          <div
            key={s.id}
            className={`h-2 w-2 rounded-full transition-colors ${i === index ? 'bg-sky-400' : 'bg-sky-500/30'}`}
          />
        ))}
      </div>
    </div>
  );
}
