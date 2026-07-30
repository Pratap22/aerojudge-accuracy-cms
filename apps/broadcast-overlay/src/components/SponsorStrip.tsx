import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_SPONSORS } from '../lib/types';

interface SponsorStripProps {
  visible?: boolean;
}

export function SponsorStrip({ visible = true }: SponsorStripProps) {
  const [index, setIndex] = useState(0);
  const sponsors = DEFAULT_SPONSORS;

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % sponsors.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [sponsors.length]);

  if (!visible) return null;

  const current = sponsors[index];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30">
      <div className="mx-auto flex max-w-2xl items-center justify-center bg-broadcast-navy/80 py-2 backdrop-blur-sm">
        <AnimatePresence mode="wait">
          <motion.span
            key={current.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="font-display text-lg tracking-[0.2em] text-white/80"
          >
            {current.name}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
