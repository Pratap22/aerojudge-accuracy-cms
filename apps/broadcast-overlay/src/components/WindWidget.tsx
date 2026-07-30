import { motion } from 'framer-motion';
import { Wind, Navigation } from 'lucide-react';
import type { WindData } from '../lib/types';
import { windDirectionLabel } from '../lib/utils';

interface WindWidgetProps {
  wind: WindData | null;
  visible?: boolean;
}

export function WindWidget({ wind, visible = true }: WindWidgetProps) {
  if (!visible || !wind) return null;

  return (
    <motion.div
      initial={{ x: 50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed right-8 top-32 z-40"
    >
      <div className="rounded-xl border border-sky-500/30 bg-broadcast-navy/90 px-5 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Wind className="h-4 w-4 text-sky-400" />
          <div>
            <p className="font-mono text-xl font-bold text-white">{wind.speedMs.toFixed(1)} m/s</p>
            <p className="flex items-center gap-1 text-xs text-sky-400">
              <Navigation className="h-3 w-3" style={{ transform: `rotate(${wind.directionDeg}deg)` }} />
              {windDirectionLabel(wind.directionDeg)} {Math.round(wind.directionDeg)}°
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
