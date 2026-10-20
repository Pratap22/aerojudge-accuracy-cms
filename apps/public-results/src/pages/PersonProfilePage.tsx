import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { PilotCareer } from '../components/PilotCareer';
import { competitionPath, fetchCareer } from '../lib/api';

export function PersonProfilePage() {
  const { competitionId, aeroJudgeId } = useParams<{
    competitionId: string;
    aeroJudgeId: string;
  }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['person-career', aeroJudgeId],
    queryFn: () => fetchCareer(aeroJudgeId!),
    enabled: Boolean(aeroJudgeId),
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
          <h1 className="font-display text-3xl text-foreground">Profile not found</h1>
          <Link
            to={competitionPath(competitionId ?? '')}
            className="mt-4 inline-block text-sky-700 hover:underline dark:text-sky-400"
          >
            Back to the competition
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
          to: `${competitionPath(competitionId ?? '', 'event')}#officials`,
          label: 'Organizing team',
        }}
      />
    </Layout>
  );
}
