import { Navigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Hero } from '../components/Hero';
import { useCompetition, useResults } from '../hooks/useCompetition';
import { pilotFullName, formatScore } from '../lib/utils';

export function HomePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: competition, isLoading, error } = useCompetition();
  const { data: results } = useResults('OVERALL');

  if (!slug) return <Navigate to="/npha-acc-2024" replace />;

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
        </div>
      </Layout>
    );
  }

  const topPilots =
    results?.rankings.slice(0, 3).map((r) => ({
      rank: r.rank,
      name: pilotFullName(r.pilot.firstName, r.pilot.lastName),
      score: Number(formatScore(r.totalScoreCm)),
      country: r.pilot.country?.code ?? r.pilot.nationality ?? 'XX',
    })) ?? [];

  return (
    <Layout>
      <Hero competition={competition} slug={slug} topPilots={topPilots} />
    </Layout>
  );
}
