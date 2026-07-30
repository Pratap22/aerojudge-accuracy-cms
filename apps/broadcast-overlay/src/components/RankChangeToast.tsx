import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { RankChangeToast } from '../lib/types';

interface RankChangeToastListProps {
  toasts: RankChangeToast[];
}

export function RankChangeToastList({ toasts }: RankChangeToastListProps) {
  return (
    <div className="fixed right-8 bottom-32 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const improved = toast.newRank < toast.oldRank;
          return (
            <motion.div
              key={toast.id}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 backdrop-blur-sm ${
                improved
                  ? 'border-emerald-500/40 bg-emerald-500/20'
                  : 'border-red-500/40 bg-red-500/20'
              }`}
            >
              {improved ? (
                <ArrowUp className="h-5 w-5 text-emerald-400" />
              ) : (
                <ArrowDown className="h-5 w-5 text-red-400" />
              )}
              <div>
                <p className="font-semibold text-white">
                  #{toast.pilotNumber} {toast.pilotName}
                </p>
                <p className={`text-sm ${improved ? 'text-emerald-400' : 'text-red-400'}`}>
                  #{toast.oldRank} → #{toast.newRank}
                </p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
