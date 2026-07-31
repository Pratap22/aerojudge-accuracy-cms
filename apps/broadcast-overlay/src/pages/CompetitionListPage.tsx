import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { competitionPath, fetchCompetitions } from '../lib/api';
import type { PublicCompetitionSummary } from '../lib/types';

function formatRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${new Date(start).toLocaleDateString(undefined, opts)} – ${new Date(end).toLocaleDateString(undefined, opts)}`;
}

function CompetitionCard({ competition }: { competition: PublicCompetitionSummary }) {
  return (
    <Link
      to={competitionPath(competition.id)}
      className="pointer-events-auto block rounded-lg border border-white/20 bg-black/70 p-4 text-left transition hover:border-sky-400/50 hover:bg-black/80"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{competition.name}</h3>
          <p className="mt-1 text-sm text-white/60">
            {competition.venue}
            {competition.country ? ` · ${competition.country}` : ''}
          </p>
          <p className="mt-1 text-xs text-white/40">{formatRange(competition.startDate, competition.endDate)}</p>
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-sky-300">
          {competition.status.replace(/_/g, ' ')}
        </span>
      </div>
    </Link>
  );
}

export function CompetitionListPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-competitions'],
    queryFn: fetchCompetitions,
  });

  if (isLoading) {
    return (
      <div className="pointer-events-auto flex min-h-screen items-center justify-center bg-transparent">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="pointer-events-auto flex min-h-screen flex-col items-center justify-center p-8 text-center">
        <p className="text-lg font-semibold text-red-400">Could not load competitions</p>
        <p className="mt-2 text-sm text-white/60">{error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }

  const sections = [
    { title: 'Active', items: data?.active ?? [], empty: 'No active competitions.' },
    { title: 'Past', items: data?.past ?? [], empty: 'No past competitions.' },
  ];

  return (
    <div className="pointer-events-auto min-h-screen bg-[#0a0a0a] px-6 py-10 text-white">
      <div className="mx-auto max-w-lg">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Broadcast Overlay</p>
        <h1 className="mt-2 text-2xl font-bold">Select a competition</h1>
        <p className="mt-2 text-sm text-white/50">
          Open a competition, then use this URL as an OBS browser source.
        </p>

        <div className="mt-8 space-y-8">
          {sections.map(({ title, items, empty }) => (
            <section key={title} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-white/40">{title}</h2>
              {items.length === 0 ? (
                <p className="text-sm text-white/40">{empty}</p>
              ) : (
                items.map((c) => <CompetitionCard key={c.id} competition={c} />)
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
