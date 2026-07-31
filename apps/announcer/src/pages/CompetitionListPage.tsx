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
      className="block rounded-xl border border-white/10 bg-white/5 p-5 transition hover:border-sky-400/40 hover:bg-white/10"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white">{competition.name}</h3>
          <p className="mt-1 text-sm text-sky-300/80">
            {competition.venue}
            {competition.country ? ` · ${competition.country}` : ''}
          </p>
          <p className="mt-2 text-xs text-sky-500/70">{formatRange(competition.startDate, competition.endDate)}</p>
        </div>
        <span className="shrink-0 rounded border border-sky-500/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
          {competition.status.replace(/_/g, ' ')}
        </span>
      </div>
    </Link>
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
      <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-400/70">{title}</h2>
      {competitions.length === 0 ? (
        <p className="text-sm text-sky-500/60">{empty}</p>
      ) : (
        <div className="space-y-3">
          {competitions.map((c) => (
            <CompetitionCard key={c.id} competition={c} />
          ))}
        </div>
      )}
    </section>
  );
}

export function CompetitionListPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-competitions'],
    queryFn: fetchCompetitions,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tent-navy">
        <Loader2 className="h-10 w-10 animate-spin text-sky-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-tent-navy p-8 text-center">
        <p className="text-2xl font-bold text-red-400">Could not load competitions</p>
        <p className="mt-2 text-sky-400/80">{error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tent-navy px-6 py-12 md:px-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-sky-400/60">Announcer Console</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Select a competition</h1>
        <p className="mt-2 text-sky-400/70">Choose a competition to open the live announcer view.</p>

        <div className="mt-10 space-y-10">
          <Section
            title="Active"
            competitions={data?.active ?? []}
            empty="No active competitions with public results enabled."
          />
          <Section title="Past" competitions={data?.past ?? []} empty="No past competitions yet." />
        </div>
      </div>
    </div>
  );
}
