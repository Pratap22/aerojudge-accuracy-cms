import { motion } from 'framer-motion';
import { Target, Crosshair, Users, Layers } from 'lucide-react';
import type { CompetitionStats } from '../lib/types';
import { formatScore } from '../lib/utils';

interface StatsPanelProps {
  stats: CompetitionStats;
}

export function StatsPanel({ stats }: StatsPanelProps) {
  const items = [
    {
      icon: Target,
      label: 'Bullseyes Today',
      value: String(stats.bullseyesToday),
      color: 'text-emerald-400',
    },
    {
      icon: Crosshair,
      label: 'Closest to Bullseye',
      value: stats.closestToBullseye
        ? `${stats.closestToBullseye.name} (${formatScore(stats.closestToBullseye.scoreCm)} cm)`
        : '—',
      color: 'text-amber-400',
    },
    {
      icon: Users,
      label: 'Total Pilots',
      value: String(stats.totalPilots),
      color: 'text-sky-400',
    },
    {
      icon: Layers,
      label: 'Rounds Flown',
      value: String(stats.roundsFlown),
      color: 'text-sky-300',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="rounded-xl border border-white/10 bg-tent-panel p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <item.icon className={`h-4 w-4 ${item.color}`} />
            <span className="text-xs uppercase tracking-wider text-white/50">{item.label}</span>
          </div>
          <p className={`font-semibold ${item.color}`}>{item.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
