import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AeroJudgeLogo } from '@aero-judge/ui';
import { ArrowRight, Loader2, Medal, Moon, Radio, Sun, Users, BarChart3 } from 'lucide-react';
import { useTheme } from '../lib/theme';
import { competitionPath, fetchCompetitions } from '../lib/api';
import type { PublicCompetitionSummary } from '../lib/types';
import { formatDate } from '../lib/utils';
import { ListSeo } from '../components/Seo';
import { FaiCategoryBadge } from '../components/FaiCategoryBadge';

function statusTone(status: string) {
  if (status === 'COMPLETED') return 'border-amber-400/40 text-amber-800 dark:text-amber-200';
  if (status === 'OFFICIAL' || status === 'PRACTICE') return 'border-emerald-400/40 text-emerald-800 dark:text-emerald-300';
  return 'border-sky-500/30 text-sky-700 dark:text-sky-300';
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
    // Prefer completed rounds for past events; fall back to scoring-aligned roundCount
    competition.roundCount != null && competition.roundCount > 0
      ? `${competition.roundCount} rounds`
      : null,
  ].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.4 }}
    >
      <Link
        to={competitionPath(competition.id)}
        className="group block overflow-hidden rounded-2xl border border-border bg-card transition hover:border-sky-400/40 hover:bg-muted"
      >
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            {competition.organizer && (
              <p className="text-sm italic text-muted-foreground">{competition.organizer}</p>
            )}
            <h3 className="mt-1 font-display text-2xl text-foreground transition group-hover:text-foreground">
              {competition.name}
            </h3>
            <p className="mt-2 text-muted-foreground">
              {competition.venue}
              {competition.country ? ` · ${competition.country}` : ''}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatDate(competition.startDate)} – {formatDate(competition.endDate)}
            </p>
            {meta.length > 0 && (
              <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {meta.join(' · ')}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <FaiCategoryBadge value={competition.faiCategory} />
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${statusTone(competition.status)}`}
              >
                {competition.status.replace(/_/g, ' ')}
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 dark:text-sky-400 opacity-0 transition group-hover:opacity-100">
              Open event
              <ArrowRight className="h-4 w-4" />
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
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">{title}</h2>
        {competitions.length > 0 && (
          <span className="text-xs text-muted-foreground">{competitions.length}</span>
        )}
      </div>
      {competitions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-8 text-sm text-muted-foreground">
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

const HIGHLIGHTS = [
  {
    icon: Radio,
    title: 'Live standings',
    body: 'Follow overall rankings as scores land, round by round.',
  },
  {
    icon: Medal,
    title: 'Categories & podium',
    body: 'Women, teams, countries, and final podium when the event closes.',
  },
  {
    icon: Users,
    title: 'Pilot profiles',
    body: 'Browse the field and open individual score sheets.',
  },
  {
    icon: BarChart3,
    title: 'Statistics',
    body: 'Bullseyes, averages, and competition-wide scoring trends.',
  },
] as const;

export function CompetitionListPage() {
  const { theme, toggleTheme } = useTheme();
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-competitions'],
    queryFn: fetchCompetitions,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-sky-700 dark:text-sky-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center text-foreground">
        <h1 className="text-2xl font-semibold text-red-400">Could not load competitions</h1>
        <p className="mt-2 text-muted-foreground">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  const active = data?.active ?? [];
  const past = data?.past ?? [];
  const total = active.length + past.length;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <ListSeo />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-100 via-background to-background dark:from-[#0a1628] dark:via-[#050d1a] dark:to-[#050d1a]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 70% 45% at 50% -10%, rgba(56, 189, 248, 0.18) 0%, transparent 55%),
            radial-gradient(ellipse 40% 30% at 90% 20%, rgba(14, 165, 233, 0.08) 0%, transparent 50%)
          `,
        }}
      />

      <div className="relative mx-auto max-w-3xl px-6 py-16 md:py-20">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-start justify-between gap-4">
            <AeroJudgeLogo className="h-16 w-auto" />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Events
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Upcoming registration, live competitions, and past accuracy events — open an event to
            follow rankings and scores.
          </p>
          {total > 0 && (
            <p className="mt-4 text-xs uppercase tracking-[0.25em] text-muted-foreground">
              {active.length} active · {past.length} past
            </p>
          )}
        </motion.header>

        <div className="mt-14 space-y-12">
          <Section
            title="Active"
            competitions={active}
            empty="No active competitions with public access enabled."
          />
          <Section title="Past" competitions={past} empty="No past competitions yet." />
        </div>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mt-20 border-t border-border pt-14"
        >
          <h2 className="font-display text-2xl text-foreground">What you can explore</h2>
          <p className="mt-2 text-muted-foreground">
            Every published event surfaces the same competition experience.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-muted/40 p-5"
              >
                <Icon className="h-5 w-5 text-sky-700 dark:text-sky-400" />
                <h3 className="mt-3 font-medium text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <footer className="mt-20 flex flex-col items-center gap-3 border-t border-border pt-8">
          <AeroJudgeLogo className="h-14 w-auto" />
          <p className="text-sm text-muted-foreground">Professional competition management for air sports</p>
        </footer>
      </div>
    </div>
  );
}
