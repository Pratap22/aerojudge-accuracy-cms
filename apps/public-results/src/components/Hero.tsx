import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, UserPlus, Users } from 'lucide-react';
import type { PublicCompetition } from '../lib/types';
import { competitionPath } from '../lib/api';
import { venueDisplayUrl } from '../lib/display-url';
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
  const titleMaxPx = titleLength > 70 ? 36 : titleLength > 45 ? 44 : titleLength > 28 ? 56 : 64;

  return (
    <section className="relative overflow-hidden">
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
        className="absolute bottom-0 left-0 right-0 h-32 bg-sky-200/80 opacity-40 dark:bg-[#0a1628] dark:opacity-30"
        style={{
          clipPath:
            'polygon(0% 100%, 0% 60%, 15% 45%, 30% 55%, 45% 35%, 60% 50%, 75% 30%, 90% 45%, 100% 25%, 100% 100%)',
        }}
      />

      <div className="relative mx-auto flex max-w-7xl flex-col justify-center px-4 py-10 sm:px-6 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <p className="mb-2 font-serif text-base italic text-muted-foreground">{competition.organizer}</p>
          <FitHeading
            maxPx={titleMaxPx}
            minPx={26}
            maxHeightVh={24}
            className="mb-1 max-w-full font-display font-bold leading-[1.05] tracking-tight text-foreground text-balance"
          >
            {competition.name}
          </FitHeading>
          <h2 className="mb-4 max-w-3xl font-serif text-xl font-light text-foreground md:text-2xl">
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
            <p className="mb-5 text-xs uppercase tracking-[0.2em] text-amber-800 dark:text-amber-300/80">
              Competition completed · Official final standings
            </p>
          ) : preEvent ? (
            <p className="mb-5 text-xs uppercase tracking-[0.2em] text-amber-800 dark:text-amber-300/80">
              Registration open · Competition has not started
            </p>
          ) : (
            <div className="mb-5" />
          )}

          <div className="flex flex-wrap items-center gap-3">
            {preEvent ? (
              <>
                {registrationOpen && (
                  <Link
                    to={competitionPath(competitionId, 'register')}
                    className="group inline-flex items-center gap-2 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-[#050d1a] transition-all hover:bg-sky-400 hover:shadow-lg hover:shadow-sky-500/25"
                  >
                    <UserPlus className="h-4 w-4" />
                    Register as pilot
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                )}
                <Link
                  to={competitionPath(competitionId, 'pilots')}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-all hover:border-sky-400/40 hover:bg-muted"
                >
                  <Users className="h-4 w-4" />
                  View pilots
                </Link>
              </>
            ) : (
              <Link
                to={competitionPath(competitionId, 'results')}
                className="group inline-flex items-center gap-2 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-[#050d1a] transition-all hover:bg-sky-400 hover:shadow-lg hover:shadow-sky-500/25"
              >
                {completed ? 'View Final Results' : 'View Full Results'}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            )}
            <a
              href={venueDisplayUrl(competitionId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-all hover:border-sky-400/40 hover:bg-muted"
            >
              Venue display
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </motion.div>

        {started && topPilots.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-8 border-t border-border pt-6"
          >
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {completed ? 'Final Podium' : 'Live Leaderboard'}
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {topPilots.slice(0, 3).map((pilot) => (
                <div key={pilot.rank} className="flex items-baseline gap-4">
                  <span className="font-display text-2xl text-muted-foreground">#{pilot.rank}</span>
                  <div>
                    <p className="font-semibold text-foreground">{pilot.name}</p>
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
