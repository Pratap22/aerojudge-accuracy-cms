import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { PilotCareer } from '../components/PilotCareer';
import { fetchCareer } from '../lib/api';
import { useDocumentSeo } from '../lib/seo';

function storyBackUrl(value: string | null): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    if (!/^\/blog\/[^/]+$/.test(url.pathname)) return '';
    const here = window.location.hostname;
    const local = here === 'localhost' || here === '127.0.0.1';
    const targetLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.host === window.location.host || (local && targetLocal)) return url.toString();
    return '';
  } catch {
    return '';
  }
}

export function PilotCareerPage() {
  const { aeroJudgeId = '' } = useParams<{ aeroJudgeId: string }>();
  const [params] = useSearchParams();
  const story = storyBackUrl(params.get('story'));
  const competitionId = params.get('competition')?.trim() || undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ['person-career', aeroJudgeId],
    queryFn: () => fetchCareer(aeroJudgeId),
    enabled: Boolean(aeroJudgeId),
  });

  useDocumentSeo({
    title: data ? `${data.displayName} · AeroJudge` : 'Pilot · AeroJudge',
    description: data ? `${data.displayName} — paragliding accuracy on AeroJudge.` : undefined,
    url: typeof window !== 'undefined' ? window.location.href.split('?')[0] : undefined,
    image: data?.photoUrl ?? undefined,
    noIndex: Boolean(error),
  });

  if (isLoading) {
    return (
      <Layout seo="none">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout seo="none">
        <div className="mx-auto max-w-3xl px-6 py-12 text-center">
          <h1 className="font-display text-3xl text-foreground">Pilot not found</h1>
          <Link to="/" className="mt-4 inline-block text-sky-700 hover:underline dark:text-sky-400">
            Events
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout seo="none">
      <PilotCareer
        career={data}
        highlightCompetitionId={competitionId}
        back={story ? { to: story, label: 'Story' } : undefined}
      />
    </Layout>
  );
}
