import { useEffect, useState } from 'react';
import { ArrowUpRight, Clock3, Target, Users, UsersRound } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  competitionResultsHref,
  fetchPublicCompetitions,
  type PublicCompetitionSummary,
} from '@/lib/api';
import { estimateHoursSaved, formatHoursSaved } from '@/lib/time-saved';
import { easeOut } from '@/lib/motion';
import { Stagger, StaggerItem } from '../motion/Reveal';
import { SectionHeading } from '../ui/SectionHeading';

const OPEN_STATUSES = new Set(['REGISTRATION', 'PRACTICE', 'OFFICIAL', 'PAUSED']);

function isOpenCompetition(status: string): boolean {
  return OPEN_STATUSES.has(status);
}

function statusLabel(status: string): string {
  if (status === 'COMPLETED') return 'Completed';
  if (status === 'REGISTRATION') return 'Registration';
  if (status === 'PRACTICE') return 'Practice';
  if (status === 'PAUSED') return 'Paused';
  if (status === 'OFFICIAL') return 'Live';
  return status.replace(/_/g, ' ');
}

function formatEventDates(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
  if (s.toDateString() === e.toDateString()) return s.toLocaleDateString(undefined, opts);
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

function byLatestStart(a: PublicCompetitionSummary, b: PublicCompetitionSummary): number {
  return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase leading-tight tracking-wide text-sky sm:gap-1.5 sm:text-[11px] sm:tracking-wider">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{label}</span>
      </div>
      <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-navy">{value}</p>
    </div>
  );
}

/** Open + completed public competitions — latest first, near the top of the home page. */
export function EventsSection() {
  const reduce = useReducedMotion();
  const [items, setItems] = useState<PublicCompetitionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublicCompetitions()
      .then((data) => {
        if (cancelled) return;
        const open = data.active.filter((c) => isOpenCompetition(c.status));
        const completed = data.past.filter((c) => c.status === 'COMPLETED');
        setItems([...open, ...completed].sort(byLatestStart));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load competitions');
        setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showEmpty = items !== null && items.length === 0 && !error;

  return (
    <section
      id="events"
      className="section-pad relative overflow-hidden bg-secondary/35"
      aria-labelledby="events-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-target-ring opacity-50"
        aria-hidden
      />
      <div className="content-width relative">
        <SectionHeading
          eyebrow="Competitions"
          title="Open and recent events on AeroJudge."
          id="events-heading"
          description="Latest events first. Time saved on a finished meet is an estimate against paper and spreadsheet workflows."
        />

        {items === null && (
          <p className="mt-10 text-sm text-muted-foreground">Loading competitions…</p>
        )}

        {error && (
          <p className="mt-10 text-sm text-muted-foreground">
            Public competitions will appear here once results are published.
          </p>
        )}

        {showEmpty && (
          <p className="mt-10 text-sm text-muted-foreground">
            No open or completed public competitions yet — check back when a meet goes live.
          </p>
        )}

        {items && items.length > 0 && (
          <Stagger as="ul" className="mt-6 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3" stagger={0.05}>
            {items.map((competition) => {
              const open = isOpenCompetition(competition.status);
              const rounds = competition.completedRounds || competition.roundCount;
              const pilots = competition.pilotCount;
              const hours = estimateHoursSaved(pilots, rounds);
              const href = competitionResultsHref(competition);
              const place = [competition.venue, competition.country].filter(Boolean).join(' · ');
              const dates = formatEventDates(competition.startDate, competition.endDate);

              return (
                <StaggerItem key={competition.id} as="li" className="min-w-0">
                  <motion.a
                    href={href}
                    className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white p-4 shadow-sm outline-none transition-colors hover:border-sky/40 focus-visible:ring-2 focus-visible:ring-sky"
                    whileHover={reduce ? undefined : { y: -4 }}
                    transition={{ duration: 0.25, ease: easeOut }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={
                          open
                            ? 'text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600'
                            : 'text-[11px] font-semibold uppercase tracking-[0.16em] text-sky'
                        }
                      >
                        {statusLabel(competition.status)}
                      </p>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-navy/5 px-2.5 py-1 text-xs font-semibold text-navy transition-colors group-hover:bg-sky/15 group-hover:text-sky">
                        {open ? 'Live' : 'Results'}
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    </div>
                    <h3 className="mt-1 font-display text-lg font-bold leading-snug text-navy">
                      {competition.name}
                    </h3>
                    <p className="mt-1 text-sm leading-snug text-muted-foreground">
                      {place}
                      {dates ? ` · ${dates}` : ''}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground/80">
                      {competition.organizer}
                    </p>

                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/80 pt-3">
                      <Stat icon={Target} label="Rounds" value={String(rounds)} />
                      <Stat icon={Users} label="Pilots" value={String(pilots)} />
                      {open ? (
                        <Stat icon={UsersRound} label="Teams" value={String(competition.teamCount)} />
                      ) : (
                        <Stat icon={Clock3} label="Time saved" value={formatHoursSaved(hours)} />
                      )}
                    </div>

                  </motion.a>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}

      </div>
    </section>
  );
}

/** @deprecated Use EventsSection — kept for any lingering imports. */
export const TestimonialsSection = EventsSection;
