import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, MonitorPlay, Radio, Trophy, Users } from 'lucide-react';
import { competitionPath, fetchCompetitions } from '../lib/api';
import type { PublicCompetitionSummary } from '../lib/types';

function formatRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${new Date(start).toLocaleDateString(undefined, opts)} – ${new Date(end).toLocaleDateString(undefined, opts)}`;
}

function statusTone(status: string) {
  if (status === 'COMPLETED') return 'border-amber-400/40 text-amber-200';
  if (status === 'OFFICIAL' || status === 'PRACTICE') return 'border-emerald-400/40 text-emerald-300';
  return 'border-sky-500/30 text-sky-300';
}

function CompetitionCard({
  competition,
  index,
}: {
  competition: PublicCompetitionSummary;
  index: number;
}) {
  const meta = [
    competition.pilotCount != null ? `${competition.pilotCount} pilots` : null,
    competition.teamCount != null && competition.teamCount > 0
      ? `${competition.teamCount} teams`
      : null,
    competition.roundCount != null && competition.roundCount > 0
      ? `${competition.roundCount} rounds`
      : null,
  ].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.35 }}
    >
      <Link
        to={competitionPath(competition.id)}
        className="group block rounded-xl border border-sky-500/20 bg-broadcast-navy-mid/60 p-5 transition hover:border-sky-400/50 hover:bg-broadcast-navy-mid"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            {competition.organizer && (
              <p className="text-xs uppercase tracking-[0.2em] text-sky-500/70">
                {competition.organizer}
              </p>
            )}
            <h3 className="mt-1 font-display text-xl uppercase tracking-wide text-white">
              {competition.name}
            </h3>
            <p className="mt-1 text-sm text-sky-300/80">
              {competition.venue}
              {competition.country ? ` · ${competition.country}` : ''}
            </p>
            <p className="mt-2 text-xs text-sky-500/70">
              {formatRange(competition.startDate, competition.endDate)}
            </p>
            {meta.length > 0 && (
              <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-sky-400/50">
                {meta.join(' · ')}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
            <span
              className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusTone(competition.status)}`}
            >
              {competition.status.replace(/_/g, ' ')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-sky-400 opacity-0 transition group-hover:opacity-100">
              Open display
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function Section({
  title,
  competitions,
  empty,
}: {
  title: string;
  competitions: PublicCompetitionSummary[];
  empty: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-400/70">{title}</h2>
        {competitions.length > 0 && (
          <span className="text-xs text-sky-500/50">{competitions.length}</span>
        )}
      </div>
      {competitions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-sky-500/20 px-5 py-8 text-sm text-sky-500/60">
          {empty}
        </p>
      ) : (
        <div className="space-y-3">
          {competitions.map((c, i) => (
            <CompetitionCard key={c.id} competition={c} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}

const DISPLAY_FEATURES = [
  {
    icon: Radio,
    title: 'Live scoring',
    body: 'Current pilot, latest score, and round status for the venue screen.',
  },
  {
    icon: Trophy,
    title: 'Leaderboards',
    body: 'Top 10, women, teams, and country rankings rotate in auto mode.',
  },
  {
    icon: Users,
    title: 'Partners strip',
    body: 'Sponsors or supporters run along the bottom of every layout.',
  },
  {
    icon: MonitorPlay,
    title: 'Finals podium',
    body: 'When the event is closed, individual and team podiums rotate on screen.',
  },
] as const;

export function CompetitionListPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-competitions'],
    queryFn: fetchCompetitions,
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-broadcast-navy">
        <Loader2 className="h-12 w-12 animate-spin text-sky-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-broadcast-navy p-8 text-center">
        <p className="font-display text-3xl text-red-400">Could not load competitions</p>
        <p className="mt-3 text-sky-400/80">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  const active = data?.active ?? [];
  const past = data?.past ?? [];

  return (
    <div className="relative min-h-screen overflow-hidden bg-broadcast-navy">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 65% 40% at 50% -5%, rgba(56, 189, 248, 0.16) 0%, transparent 55%),
            radial-gradient(ellipse 35% 25% at 100% 30%, rgba(14, 165, 233, 0.08) 0%, transparent 50%)
          `,
        }}
      />

      <div className="relative mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-16">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <p className="text-xs uppercase tracking-[0.4em] text-sky-400/70">AeroJudge</p>
          <h1 className="mt-2 font-display text-4xl uppercase tracking-wider text-white md:text-5xl">
            Venue display
          </h1>
          <p className="mt-3 max-w-xl text-sky-400/80">
            Choose a competition to open the full-screen board for the landing zone, hangar, or
            spectator area.
          </p>
          <p className="mt-4 text-[11px] uppercase tracking-[0.25em] text-sky-500/50">
            {active.length} active · {past.length} past
          </p>
        </motion.header>

        <div className="mt-12 space-y-10">
          <Section
            title="Active"
            competitions={active}
            empty="No active competitions with public results enabled."
          />
          <Section title="Past" competitions={past} empty="No past competitions yet." />
        </div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.45 }}
          className="mt-16 border-t border-sky-500/20 pt-12"
        >
          <h2 className="font-display text-2xl uppercase tracking-wide text-white">
            On the display
          </h2>
          <p className="mt-2 text-sm text-sky-400/70">
            Layouts cycle automatically, or pick one from the on-screen controls.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {DISPLAY_FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-xl border border-sky-500/20 bg-broadcast-navy-mid/40 p-4"
              >
                <Icon className="h-5 w-5 text-sky-400" />
                <h3 className="mt-3 text-sm font-semibold uppercase tracking-wider text-white">
                  {title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-sky-300/70">{body}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <footer className="mt-16 border-t border-sky-500/20 pt-8 text-center text-xs uppercase tracking-[0.3em] text-sky-500/50">
          AeroJudge · Venue display
        </footer>
      </div>
    </div>
  );
}
