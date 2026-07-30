import { motion } from 'framer-motion';
import { Wind, Navigation } from 'lucide-react';
import type { WindData } from '../lib/types';
import { windDirectionLabel } from '../lib/utils';

interface WindDisplayProps {
  wind: WindData | null;
}

export function WindDisplay({ wind }: WindDisplayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-xl border border-white/10 bg-tent-panel p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <Wind className="h-5 w-5 text-sky-400" />
        <h3 className="text-sm font-bold uppercase tracking-[0.25em] text-sky-400">Live Wind</h3>
      </div>

      {wind ? (
        <div className="flex items-center gap-8">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-sky-500/30 bg-tent-navy">
            <motion.div
              animate={{ rotate: wind.directionDeg }}
              transition={{ type: 'spring', stiffness: 80 }}
              className="absolute"
            >
              <Navigation className="h-8 w-8 text-sky-400" style={{ transform: 'translateY(-20px)' }} />
            </motion.div>
            <span className="text-xs text-white/50">{windDirectionLabel(wind.directionDeg)}</span>
          </div>
          <div>
            <p className="font-mono text-4xl font-bold text-white">{wind.speedMs.toFixed(1)}</p>
            <p className="text-sm text-sky-300">m/s · {Math.round(wind.directionDeg)}°</p>
          </div>
        </div>
      ) : (
        <p className="py-6 text-center text-white/30">No wind data</p>
      )}
    </motion.div>
  );
}
