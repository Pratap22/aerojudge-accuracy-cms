import { useParams } from 'react-router-dom';

/** Competition id from the URL path – shareable, no localStorage. */
export function useCompetitionId(): string | undefined {
  const { competitionId } = useParams<{ competitionId: string }>();
  return competitionId;
}

export function competitionPath(competitionId: string, segment = ''): string {
  const base = `/competitions/${competitionId}`;
  if (!segment || segment === '/') return base;
  return `${base}/${segment.replace(/^\//, '')}`;
}
