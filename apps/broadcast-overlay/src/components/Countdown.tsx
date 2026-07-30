import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Timer } from 'lucide-react';
import { getCountdownTarget } from '../lib/utils';

interface CountdownProps {
  visible?: boolean;
  targetDate?: Date | null;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function Countdown({ visible = true, targetDate }: CountdownProps) {
  const target = targetDate ?? getCountdownTarget();
  const [remaining, setRemaining] = useState<number>(() =>
    target ? Math.max(0, target.getTime() - Date.now()) : 0,
  );

  useEffect(() => {
    if (!target) return;
    const timer = setInterval(() => {
      setRemaining(Math.max(0, target.getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(timer);
  }, [target]);

  if (!visible || !target) return null;

  const urgent = remaining < 60_000;

  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed left-1/2 top-8 z-40 -translate-x-1/2"
    >
      <div
        className={`flex items-center gap-3 rounded-full border-2 px-6 py-3 backdrop-blur-sm ${
          urgent
            ? 'border-red-500/60 bg-red-500/20'
            : 'border-sky-500/40 bg-broadcast-navy/90'
        }`}
      >
        <Timer className={`h-5 w-5 ${urgent ? 'text-red-400' : 'text-sky-400'}`} />
        <span className={`font-mono text-3xl font-bold tabular-nums ${urgent ? 'text-red-400' : 'text-white'}`}>
          {formatCountdown(remaining)}
        </span>
      </div>
    </motion.div>
  );
}
