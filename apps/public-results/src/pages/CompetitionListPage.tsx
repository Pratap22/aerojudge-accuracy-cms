import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { competitionPath, fetchCompetitions } from '../lib/api';
import type { PublicCompetitionSummary } from '../lib/types';
import { formatDate } from '../lib/utils';

function CompetitionCard({ competition }: { competition: PublicCompetitionSummary }) {
  return (
    <Link
      to={competitionPath(competition.id)}
      className="block rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-sky-400/40 hover:bg-white/10"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl text-white">{competition.name}</h3>
          <p className="mt-1 text-sky-300/80">
            {competition.venue}
            {competition.country ? ` · ${competition.country}` : ''}
          </p>
          <p className="mt-2 text-sm text-sky-500/70">
            {formatDate(competition.startDate)} – {formatDate(competition.endDate)}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-sky-500/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">
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
    <section className="space-y-4">
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-10 w-10 animate-spin text-sky-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-8 text-center text-slate-100">
        <h1 className="text-2xl font-semibold text-red-400">Could not load competitions</h1>
        <p className="mt-2 text-slate-400">{error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm uppercase tracking-[0.3em] text-sky-400/70">AeroJudge</p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-white">Select a competition</h1>
        <p className="mt-3 text-slate-400">Browse active and past competitions with public results.</p>

        <div className="mt-12 space-y-12">
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
