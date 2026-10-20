import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { padPilotNumber } from '@aero-judge/utils';
import { competitionPath, type PublicCareer } from '../lib/api';
import { countryCodeToEmoji, formatScore } from '../lib/utils';

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const startLabel = start.toLocaleDateString('en-GB', opts);
  if (start.toDateString() === end.toDateString()) return startLabel;
  return `${startLabel} – ${end.toLocaleDateString('en-GB', opts)}`;
}

function placeLabel(venue: string, country: string): string {
  return [venue, country].filter((part) => part.trim()).join(', ');
}

interface PilotCareerProps {
  career: PublicCareer;
  back: { to: string; label: string };
  /** Competition the visitor came from, marked in the list. */
  highlightCompetitionId?: string;
  notice?: string | null;
}

export function PilotCareer({ career, back, highlightCompetitionId, notice }: PilotCareerProps) {
  const flag = countryCodeToEmoji(career.nationality?.code2 ?? '');
  const countryName = career.nationality?.name || career.nationality?.code || '';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        to={back.to}
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-sky-700 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
      >
        <ArrowLeft className="h-4 w-4" />
        {back.label}
      </Link>

      {notice ? (
        <p className="mb-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          {notice}
        </p>
      ) : null}

      <header className="flex items-center gap-5 border-b border-border pb-8 sm:gap-6">
        {career.photoUrl ? (
          <img
            src={career.photoUrl}
            alt=""
            className="h-28 w-28 shrink-0 rounded-full object-cover object-top ring-2 ring-sky-500/30 sm:h-32 sm:w-32"
          />
        ) : (
          <span className="h-28 w-28 shrink-0 rounded-full bg-muted sm:h-32 sm:w-32" aria-hidden />
        )}
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {career.displayName}
          </h1>
          {countryName ? (
            <p className="mt-2 text-lg text-foreground">
              {flag ? <span aria-hidden>{flag} </span> : null}
              {countryName}
            </p>
          ) : null}
          {career.civlId ? (
            <p className="mt-1 text-sm text-muted-foreground">CIVL {career.civlId}</p>
          ) : null}
        </div>
      </header>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-foreground sm:text-2xl">Competitions</h2>
        {career.competitions.length === 0 ? (
          <p className="mt-4 text-muted-foreground">No published competitions yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {career.competitions.map((event) => {
              const place = placeLabel(event.venue, event.country);
              const meta = [
                event.pilotNumber != null ? `No. ${padPilotNumber(event.pilotNumber)}` : null,
                formatRange(event.startDate, event.endDate),
                place || null,
              ]
                .filter(Boolean)
                .join(' · ');
              const current = event.id === highlightCompetitionId;
              return (
                <li
                  key={event.id}
                  className={current ? 'bg-sky-500/10' : undefined}
                >
                  <Link
                    to={competitionPath(event.id)}
                    className="flex items-start gap-4 px-4 py-4 transition-colors hover:bg-muted"
                  >
                    <div className="w-12 shrink-0 text-center">
                      <p className="font-display text-2xl font-bold tabular-nums text-foreground">
                        {event.rank ?? '—'}
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Rank
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sky-700 dark:text-sky-300">{event.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
                    </div>
                    <p className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                      {event.totalScoreCm != null ? `${formatScore(event.totalScoreCm)} cm` : '—'}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {career.work.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">Work</h2>
          <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {career.work.map((job) => {
              const place = placeLabel(job.venue, job.country);
              const meta = [formatRange(job.startDate, job.endDate), place || null]
                .filter(Boolean)
                .join(' · ');
              return (
                <li key={`${job.competitionId}-${job.role}`}>
                  <Link
                    to={competitionPath(job.competitionId)}
                    className="flex items-start gap-4 px-4 py-4 transition-colors hover:bg-muted"
                  >
                    <p className="w-28 shrink-0 text-sm font-semibold text-foreground sm:w-36">
                      {job.role}
                    </p>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sky-700 dark:text-sky-300">{job.competitionName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
