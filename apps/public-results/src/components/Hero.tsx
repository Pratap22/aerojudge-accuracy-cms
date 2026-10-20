import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, UserPlus, Users } from 'lucide-react';
import type { PublicCompetition } from '../lib/types';
import { competitionPath } from '../lib/api';
import { formatDate } from '../lib/utils';
import {
  hasCompetitionStarted,
  isCompetitionCompleted,
  isPreEvent,
  isRegistrationOpen,
} from '../lib/competitionStatus';
import { FitHeading } from './FitHeading';
import { FaiCategoryBadge } from './FaiCategoryBadge';

interface HeroProps {
  competition: PublicCompetition;
  competitionId: string;
  topPilots?: { rank: number; name: string; score: string; country: string }[];
}

export function Hero({ competition, competitionId, topPilots = [] }: HeroProps) {
  const completed = isCompetitionCompleted(competition.status);
  const started = hasCompetitionStarted(competition.status);
  const preEvent = isPreEvent(competition.status);
  const registrationOpen = isRegistrationOpen(competition.status);
  const titleLength = competition.name.trim().length;
  const titleMaxPx = titleLength > 70 ? 64 : titleLength > 45 ? 80 : titleLength > 28 ? 96 : 112;

  return (
    <section className="relative min-h-[85vh] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-sky-100 via-white to-slate-50 dark:from-[#0a1628] dark:via-[#0f2744] dark:to-[#050d1a]" />
      <div
        className="absolute inset-0 opacity-70 dark:hidden"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 50% 100%, rgba(14, 165, 233, 0.16) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 20% 80%, rgba(251, 191, 36, 0.14) 0%, transparent 50%)
          `,
        }}
      />
      <div
        className="absolute inset-0 hidden opacity-40 dark:block"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 50% 100%, rgba(56, 189, 248, 0.15) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 20% 80%, rgba(251, 191, 36, 0.08) 0%, transparent 50%),
            linear-gradient(180deg, transparent 60%, rgba(5, 13, 26, 0.9) 100%)
          `,
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-64 bg-sky-200/80 opacity-40 dark:bg-[#0a1628] dark:opacity-30"
        style={{
          clipPath:
            'polygon(0% 100%, 0% 60%, 15% 45%, 30% 55%, 45% 35%, 60% 50%, 75% 30%, 90% 45%, 100% 25%, 100% 100%)',
        }}
      />

      <div className="relative mx-auto flex min-h-[85vh] max-w-7xl flex-col justify-center px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <p className="mb-4 font-serif text-lg italic text-muted-foreground">{competition.organizer}</p>
          <FitHeading
            maxPx={titleMaxPx}
            minPx={26}
            maxHeightVh={38}
            className="mb-2 max-w-full font-display font-bold leading-[1.05] tracking-tight text-foreground text-balance"
          >
            {competition.name}
          </FitHeading>
          <h2 className="mb-8 max-w-3xl font-serif text-2xl font-light text-foreground md:text-3xl lg:text-4xl">
            {competition.venue}
            {competition.country ? ` · ${competition.country}` : ''}
          </h2>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <FaiCategoryBadge value={competition.faiCategory} />
            <p className="text-muted-foreground">
              {formatDate(competition.startDate)} – {formatDate(competition.endDate)}
            </p>
          </div>
          {completed ? (
            <p className="mb-12 text-sm uppercase tracking-[0.3em] text-amber-800 dark:text-amber-300/80">
              Competition completed · Official final standings
            </p>
          ) : preEvent ? (
            <p className="mb-12 text-sm uppercase tracking-[0.3em] text-amber-800 dark:text-amber-300/80">
              Registration open · Competition has not started
            </p>
          ) : (
            <div className="mb-12" />
          )}

          {preEvent ? (
            <div className="flex flex-wrap gap-4">
              {registrationOpen && (
                <Link
                  to={competitionPath(competitionId, 'register')}
                  className="group inline-flex items-center gap-3 rounded-full bg-sky-500 px-8 py-4 text-lg font-semibold text-[#050d1a] transition-all hover:bg-sky-400 hover:shadow-lg hover:shadow-sky-500/25"
                >
                  <UserPlus className="h-5 w-5" />
                  Register as pilot
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
              <Link
                to={competitionPath(competitionId, 'pilots')}
                className="inline-flex items-center gap-3 rounded-full border border-border bg-card px-8 py-4 text-lg font-semibold text-foreground transition-all hover:border-sky-400/40 hover:bg-muted"
              >
                <Users className="h-5 w-5" />
                View pilots
              </Link>
            </div>
          ) : (
            <Link
              to={competitionPath(competitionId, 'results')}
              className="group inline-flex items-center gap-3 rounded-full bg-sky-500 px-8 py-4 text-lg font-semibold text-[#050d1a] transition-all hover:bg-sky-400 hover:shadow-lg hover:shadow-sky-500/25"
            >
              {completed ? 'View Final Results' : 'View Full Results'}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          )}
        </motion.div>

        {started && topPilots.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-16 border-t border-border pt-12"
          >
            <p className="mb-6 text-sm uppercase tracking-[0.3em] text-muted-foreground">
              {completed ? 'Final Podium' : 'Live Leaderboard'}
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {topPilots.slice(0, 3).map((pilot) => (
                <div key={pilot.rank} className="flex items-baseline gap-4">
                  <span className="font-display text-4xl text-muted-foreground">#{pilot.rank}</span>
                  <div>
                    <p className="text-xl font-semibold text-foreground">{pilot.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {pilot.country} · {pilot.score} cm
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
