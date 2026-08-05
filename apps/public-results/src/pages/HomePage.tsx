import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isEmptyHtml } from '@npha/shared';
import { Layout } from '../components/Layout';
import { Hero } from '../components/Hero';
import { OrganizingTeamSection } from '../components/OrganizingTeam';
import { useCompetition, useResults } from '../hooks/useCompetition';
import { competitionPath, fetchEventInfo, fetchOfficials } from '../lib/api';
import { sanitizePublicHtml } from '../lib/rich-html';
import { pilotFullName, formatScore } from '../lib/utils';

export function HomePage() {
  const { competitionId } = useParams<{ competitionId: string }>();
  const { data: competition, isLoading, error } = useCompetition();
  const { data: results } = useResults('OVERALL');
  const {
    data: officials = [],
    isLoading: officialsLoading,
    error: officialsError,
  } = useQuery({
    queryKey: ['public-officials', competitionId],
    queryFn: () => fetchOfficials(competitionId!),
    enabled: Boolean(competitionId),
  });
  const { data: eventInfo } = useQuery({
    queryKey: ['public-event-info', competitionId],
    queryFn: () => fetchEventInfo(competitionId!),
    enabled: Boolean(competitionId) && Boolean(competition?.hasInfo),
  });

  if (!competitionId) {
    return (
      <Layout>
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <h1 className="font-display text-4xl text-white">Missing competition</h1>
          <Link to="/" className="mt-4 text-sky-400 hover:underline">
            Browse competitions
          </Link>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (error || !competition) {
    return (
      <Layout>
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <h1 className="font-display text-4xl text-white">Competition Not Found</h1>
          <p className="mt-4 text-sky-300/70">This competition may not be published or does not exist.</p>
          <Link to="/" className="mt-6 text-sky-400 hover:underline">
            Browse competitions
          </Link>
        </div>
      </Layout>
    );
  }

  const topPilots =
    results?.rankings
      .filter((r) => r.pilot)
      .slice(0, 3)
      .map((r) => ({
        rank: r.rank,
        name: pilotFullName(r.pilot!.firstName, r.pilot!.lastName),
        score: formatScore(r.totalScoreCm),
        country: r.pilot!.country?.code ?? r.pilot!.nationality ?? 'XX',
      })) ?? [];

  const aboutHtml =
    eventInfo && !isEmptyHtml(eventInfo.aboutHtml)
      ? sanitizePublicHtml(eventInfo.aboutHtml)
      : '';

  return (
    <Layout>
      <Hero competition={competition} competitionId={competitionId} topPilots={topPilots} />
      {aboutHtml ? (
        <section className="mx-auto max-w-7xl px-6 py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">About</h2>
            <Link
              to={competitionPath(competitionId, 'info')}
              className="text-sm font-medium text-sky-400 hover:text-sky-300"
            >
              Full event info →
            </Link>
          </div>
          <div
            className="rich-html mt-5 max-w-3xl text-[15px] leading-relaxed text-sky-100/75 line-clamp-[12] [&_a]:text-sky-300 [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: aboutHtml }}
          />
        </section>
      ) : null}
      <OrganizingTeamSection
        competitionId={competitionId}
        officials={officials}
        organiser={competition.organiser}
        limit={4}
        isLoading={officialsLoading}
        error={officialsError instanceof Error ? officialsError : null}
      />
    </Layout>
  );
}
