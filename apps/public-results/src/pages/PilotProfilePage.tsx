import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { PilotCareer } from '../components/PilotCareer';
import { competitionPath, fetchPilotProfile } from '../lib/api';
import { padPilotNumber } from '@aero-judge/utils';

export function PilotProfilePage() {
  const { competitionId, pilotNumber } = useParams<{ competitionId: string; pilotNumber: string }>();
  const location = useLocation();
  const justRegistered = Boolean((location.state as { justRegistered?: boolean } | null)?.justRegistered);
  const num = Number(pilotNumber);

  const { data, isLoading, error } = useQuery({
    queryKey: ['pilot-career', competitionId, num],
    queryFn: () => fetchPilotProfile(competitionId!, num),
    enabled: Boolean(competitionId) && Number.isInteger(num) && num > 0,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl px-6 py-12 text-center">
          <h1 className="font-display text-3xl text-foreground">Pilot not found</h1>
          <Link
            to={competitionPath(competitionId ?? '', 'pilots')}
            className="mt-4 inline-block text-sky-700 hover:underline dark:text-sky-400"
          >
            All pilots
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PilotCareer
        career={data}
        highlightCompetitionId={competitionId}
        back={{
          to: competitionPath(competitionId ?? '', 'pilots'),
          label: 'All pilots',
        }}
        notice={
          justRegistered
            ? `Registration received. You are pilot #${padPilotNumber(num)} — organisers can see you in the competition pilot list.`
            : null
        }
      />
    </Layout>
  );
}
