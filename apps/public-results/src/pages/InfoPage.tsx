import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { CompetitionInfoSections } from '../components/CompetitionInfoSections';
import { useCompetition } from '../hooks/useCompetition';
import { competitionPath, fetchEventInfo } from '../lib/api';

export function InfoPage() {
  const { competitionId } = useParams<{ competitionId: string }>();
  const { data: competition, isLoading: competitionLoading } = useCompetition();
  const {
    data: info,
    isLoading: infoLoading,
    error,
  } = useQuery({
    queryKey: ['public-event-info', competitionId],
    queryFn: () => fetchEventInfo(competitionId!),
    enabled: Boolean(competitionId),
  });

  if (!competitionId) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
          <h1 className="font-display text-3xl text-white">Missing competition</h1>
          <Link to="/" className="mt-4 text-sky-400 hover:underline">
            Browse competitions
          </Link>
        </div>
      </Layout>
    );
  }

  if (competitionLoading || infoLoading) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (error || !competition) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
          <h1 className="font-display text-3xl text-white">Competition Not Found</h1>
          <Link to="/" className="mt-6 text-sky-400 hover:underline">
            Browse competitions
          </Link>
        </div>
      </Layout>
    );
  }

  if (!info?.hasContent) {
    return (
      <Layout>
        <div className="mx-auto max-w-7xl px-6 py-16 text-center">
          <h1 className="font-display text-3xl text-white">Event info</h1>
          <p className="mt-3 text-sky-100/60">
            Detailed event information has not been published yet.
          </p>
          <Link
            to={competitionPath(competitionId)}
            className="mt-6 inline-block text-sky-400 hover:underline"
          >
            Back to home
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
        <header className="mb-10 max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-wider text-sky-400/70">
            Event information
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {competition.name}
          </h1>
          <p className="mt-3 text-sky-100/55">
            {[competition.venue, competition.country].filter(Boolean).join(' · ')}
          </p>
        </header>
        <CompetitionInfoSections info={info} />
      </div>
    </Layout>
  );
}
