import { motion } from 'framer-motion';
import { Target, Users, Globe, BarChart3, Trophy, Wind } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useResults, computeStats } from '../hooks/useCompetition';
import { formatScore } from '../lib/utils';

export function StatisticsPage() {
  const { data: results, isLoading } = useResults('OVERALL');
  const stats = computeStats(results);

  const statCards = [
    { icon: Users, label: 'Total Pilots', value: stats.totalPilots, color: 'text-sky-400' },
    { icon: Target, label: 'Total Bullseyes', value: stats.totalBullseyes, color: 'text-emerald-400' },
    { icon: Trophy, label: 'Best Total Score', value: `${formatScore(stats.bestScoreCm)} cm`, color: 'text-amber-400' },
    { icon: BarChart3, label: 'Average Score', value: `${formatScore(Math.round(stats.averageScoreCm))} cm`, color: 'text-sky-300' },
    { icon: Wind, label: 'Rounds Completed', value: stats.roundsCompleted, color: 'text-sky-400' },
    { icon: Globe, label: 'Countries', value: stats.countriesRepresented, color: 'text-sky-300' },
  ];

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="mb-4 font-display text-4xl font-bold text-white">Statistics</h1>
        <p className="mb-12 text-sky-300/70">Competition overview and key metrics</p>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {statCards.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="rounded-xl border border-white/10 bg-white/5 p-6"
              >
                <stat.icon className={`mb-4 h-8 w-8 ${stat.color}`} />
                <p className="text-sm uppercase tracking-wider text-sky-400/70">{stat.label}</p>
                <p className="mt-2 font-mono text-3xl font-bold text-white">{stat.value}</p>
              </motion.div>
            ))}
          </div>
        )}

        {results?.rankings && results.rankings.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 font-display text-2xl text-white">Top Performers</h2>
            <div className="space-y-3">
              {results.rankings.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-6 py-4"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-display text-2xl text-sky-400/60">#{r.rank}</span>
                    <span className="font-semibold text-white">
                      {r.pilot.firstName} {r.pilot.lastName}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-emerald-400">{r.bullseyes} bullseyes</span>
                    <span className="font-mono font-bold text-white">{formatScore(r.totalScoreCm)} cm</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
