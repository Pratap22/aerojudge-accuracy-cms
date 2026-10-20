import { motion } from 'framer-motion';
import { Target, Users, Globe, BarChart3, Trophy, Wind } from 'lucide-react';
import { useResults, computeStats } from '../hooks/useCompetition';
import { formatScore } from '../lib/utils';

export function ResultsStats() {
  const { data: results, isLoading } = useResults('OVERALL');
  const stats = computeStats(results);

  const statCards = [
    { icon: Users, label: 'Total Pilots', value: stats.totalPilots, color: 'text-sky-700 dark:text-sky-400' },
    { icon: Target, label: 'Total Bullseyes', value: stats.totalBullseyes, color: 'text-emerald-700 dark:text-emerald-400' },
    { icon: Trophy, label: 'Best Total Score', value: `${formatScore(stats.bestScoreCm)} cm`, color: 'text-amber-700 dark:text-amber-400' },
    { icon: BarChart3, label: 'Average Score', value: `${formatScore(Math.round(stats.averageScoreCm))} cm`, color: 'text-sky-700 dark:text-sky-300' },
    { icon: Wind, label: 'Rounds Completed', value: stats.roundsCompleted, color: 'text-sky-700 dark:text-sky-400' },
    { icon: Globe, label: 'Countries', value: stats.countriesRepresented, color: 'text-sky-700 dark:text-sky-300' },
  ];

  return (
    <section id="stats" className="mt-14 scroll-mt-28">
      <h2 className="font-display text-2xl font-semibold text-foreground">Statistics</h2>
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <stat.icon className={`mb-3 h-6 w-6 ${stat.color}`} />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{stat.label}</p>
              <p className="mt-1 font-mono text-2xl font-bold text-foreground">{stat.value}</p>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
