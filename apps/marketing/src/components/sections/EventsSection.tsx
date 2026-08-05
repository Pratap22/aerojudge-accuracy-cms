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
import { Reveal, Stagger, StaggerItem } from '../motion/Reveal';
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
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 font-display text-xl font-bold tabular-nums text-navy sm:text-2xl">{value}</p>
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
          description="Jump straight into live or official results. Latest events appear first."
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
          <Stagger as="ul" className="mt-12 grid gap-5 md:grid-cols-2" stagger={0.08}>
            {items.map((competition) => {
              const open = isOpenCompetition(competition.status);
              const rounds = competition.completedRounds || competition.roundCount;
              const pilots = competition.pilotCount;
              const hours = estimateHoursSaved(pilots, rounds);
              const href = competitionResultsHref(competition);
              const place = [competition.venue, competition.country].filter(Boolean).join(' · ');
              const dates = formatEventDates(competition.startDate, competition.endDate);

              return (
                <StaggerItem key={competition.id} as="li">
                  <motion.a
                    href={href}
                    className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white p-6 shadow-sm outline-none transition-colors hover:border-sky/40 focus-visible:ring-2 focus-visible:ring-sky"
                    whileHover={reduce ? undefined : { y: -4 }}
                    transition={{ duration: 0.25, ease: easeOut }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={
                            open
                              ? 'text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600'
                              : 'text-[11px] font-semibold uppercase tracking-[0.16em] text-sky'
                          }
                        >
                          {statusLabel(competition.status)}
                        </p>
                        <h3 className="mt-2 font-display text-xl font-bold leading-snug text-navy sm:text-2xl">
                          {competition.name}
                        </h3>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {place}
                          {dates ? ` · ${dates}` : ''}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground/80">
                          {competition.organizer}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-navy/5 px-3 py-1.5 text-xs font-semibold text-navy transition-colors group-hover:bg-sky/15 group-hover:text-sky">
                        {open ? 'Live results' : 'Results'}
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    </div>

                    <div className="mt-8 grid grid-cols-3 gap-4 border-t border-border/80 pt-5">
                      <Stat icon={Target} label="Rounds" value={String(rounds)} />
                      <Stat icon={Users} label="Pilots" value={String(pilots)} />
                      {open ? (
                        <Stat icon={UsersRound} label="Teams" value={String(competition.teamCount)} />
                      ) : (
                        <Stat icon={Clock3} label="Time saved" value={formatHoursSaved(hours)} />
                      )}
                    </div>

                    {!open && (
                      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                        Estimated vs traditional sheets (score entry, rankings, notice boards).
                      </p>
                    )}
                  </motion.a>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}

        <Reveal className="mt-10" y={16}>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Time saved on completed events is an estimate based on typical paper and spreadsheet
            workflows — about three minutes per pilot-round plus twenty-five minutes per round for
            rankings and venue updates.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/** @deprecated Use EventsSection — kept for any lingering imports. */
export const TestimonialsSection = EventsSection;
