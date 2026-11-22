import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Target, Users, Globe, BarChart3, Trophy, Wind } from 'lucide-react';
import { competitionPath } from '../lib/api';
import { toLeaderboardEntries, useCompetition, useResults, computeStats, useSlug } from '../hooks/useCompetition';
import { formatScore } from '../lib/utils';

export function ResultsStats() {
  const competitionId = useSlug();
  const { data: competition } = useCompetition();
  const { data: results, isLoading } = useResults('OVERALL');
  const { data: countryResults, isSuccess: countriesReady } = useResults('COUNTRY');
  const stats = computeStats(results);
  const showCountries =
    Boolean(competition) &&
    competition?.settings?.countryRankingEnabled !== false &&
    countriesReady &&
    toLeaderboardEntries(countryResults).length > 1;

  const statCards: {
    icon: typeof Users;
    label: string;
    value: string | number;
    color: string;
    href?: string;
    onClick?: () => void;
  }[] = [
    {
      icon: Users,
      label: 'Total Pilots',
      value: stats.totalPilots,
      color: 'text-sky-700 dark:text-sky-400',
      href: competitionPath(competitionId, 'pilots'),
    },
    {
      icon: Target,
      label: 'Total Bullseyes',
      value: stats.totalBullseyes,
      color: 'text-emerald-700 dark:text-emerald-400',
      href: competitionPath(competitionId, 'bullseyes'),
    },
    { icon: Trophy, label: 'Best Total Score', value: `${formatScore(stats.bestScoreCm)} cm`, color: 'text-amber-700 dark:text-amber-400' },
    { icon: BarChart3, label: 'Average Score', value: `${formatScore(Math.round(stats.averageScoreCm))} cm`, color: 'text-sky-700 dark:text-sky-300' },
    {
      icon: Wind,
      label: 'Rounds Completed',
      value: stats.roundsCompleted,
      color: 'text-sky-700 dark:text-sky-400',
      onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    },
    {
      icon: Globe,
      label: 'Countries',
      value: stats.countriesRepresented,
      color: 'text-sky-700 dark:text-sky-300',
      href: showCountries ? `${competitionPath(competitionId, 'results')}?board=countries` : undefined,
    },
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
          {statCards.map((stat, index) => {
            const interactive = Boolean(stat.href || stat.onClick);
            const className = `rounded-xl border border-border bg-card p-5 text-left${
              interactive ? ' block w-full transition-colors hover:border-sky-400' : ''
            }`;
            const content = (
              <>
                <stat.icon className={`mb-3 h-6 w-6 ${stat.color}`} />
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                <p className="mt-1 font-mono text-2xl font-bold text-foreground">{stat.value}</p>
              </>
            );
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                {stat.href ? (
                  <Link to={stat.href} className={className}>
                    {content}
                  </Link>
                ) : stat.onClick ? (
                  <button type="button" onClick={stat.onClick} className={className}>
                    {content}
                  </button>
                ) : (
                  <div className={className}>{content}</div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
