import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { OfficialCard, OrganizerCard, OrganizingTeamSection } from '../components/OrganizingTeam';
import { fetchOfficials } from '../lib/api';
import { useCompetition, useSlug } from '../hooks/useCompetition';

export function OfficialsPage() {
  const competitionId = useSlug();
  const { data: competition } = useCompetition();

  const { data: officials = [], isLoading, error } = useQuery({
    queryKey: ['public-officials', competitionId],
    queryFn: () => fetchOfficials(competitionId),
    enabled: Boolean(competitionId),
  });

  const organiser = competition?.organiser;
  const hasOrganiser = Boolean(organiser?.name);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 border-b border-white/15 pb-3">
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Organizing Team
          </h1>
          <p className="mt-2 text-sm text-sky-300/70">
            Judges and officials for this competition
          </p>
        </div>

        {isLoading && <p className="text-sky-400/60">Loading organizing team…</p>}
        {error && (
          <p className="text-red-400">
            {error instanceof Error ? error.message : 'Could not load team'}
          </p>
        )}
        {!isLoading && !error && officials.length === 0 && !hasOrganiser && (
          <OrganizingTeamSection
            competitionId={competitionId}
            officials={[]}
            showHeader={false}
          />
        )}
        {!isLoading && !error && (officials.length > 0 || hasOrganiser) && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {hasOrganiser && organiser ? (
              <OrganizerCard organiser={organiser} index={0} />
            ) : null}
            {officials.map((official, index) => (
              <OfficialCard
                key={official.id}
                official={official}
                showContact
                index={index + (hasOrganiser ? 1 : 0)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
