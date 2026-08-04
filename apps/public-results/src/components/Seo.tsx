import { useLocation } from 'react-router-dom';
import { useCompetition } from '../hooks/useCompetition';
import { defaultShareImageUrl, useDocumentSeo } from '../lib/seo';

function sectionTitle(pathname: string): string {
  if (pathname.includes('/results')) return 'Results';
  if (pathname.includes('/register')) return 'Registration';
  if (pathname.includes('/women')) return 'Women';
  if (pathname.includes('/teams')) return 'Team ranking';
  if (pathname.includes('/officials')) return 'Officials';
  if (pathname.includes('/countries')) return 'Countries';
  if (pathname.includes('/statistics')) return 'Statistics';
  if (pathname.includes('/pilots/')) return 'Pilot';
  if (pathname.includes('/pilots')) return 'Pilots';
  return '';
}

/** Per-route document meta for competition pages. */
export function CompetitionSeo() {
  const { pathname } = useLocation();
  const { data: competition } = useCompetition();
  const section = sectionTitle(pathname);

  const name = competition?.name ?? 'Competition';
  const place = [competition?.venue, competition?.country].filter(Boolean).join(' · ');
  const title = section ? `${name} — ${section} · AeroJudge` : `${name} · AeroJudge`;
  const description = competition
    ? [
        place,
        competition.organizer ? `Organized by ${competition.organizer}` : null,
        competition.status ? `Status: ${competition.status.replace(/_/g, ' ')}` : null,
        'Live and official Paragliding Accuracy results on AeroJudge.',
      ]
        .filter(Boolean)
        .join('. ')
    : 'Paragliding Accuracy competition results on AeroJudge.';

  useDocumentSeo({
    title,
    description,
    url: typeof window !== 'undefined' ? window.location.href.split('#')[0] : undefined,
    image: defaultShareImageUrl(),
  });

  return null;
}

export function ListSeo() {
  useDocumentSeo({
    title: 'AeroJudge · Events',
    description:
      'Browse accuracy competitions — registration, live standings, pilots, teams and official results.',
    url: typeof window !== 'undefined' ? window.location.href.split('#')[0] : undefined,
    image: defaultShareImageUrl(),
  });
  return null;
}
