import { useLocation } from 'react-router-dom';
import { useCompetition } from '../hooks/useCompetition';
import { defaultShareImageUrl, useDocumentSeo } from '../lib/seo';

function sectionTitle(pathname: string, search: string): string {
  if (pathname.includes('/results')) {
    const board = new URLSearchParams(search).get('board');
    if (board === 'women') return "Women's ranking";
    if (board === 'teams') return 'Team ranking';
    if (board === 'countries') return 'Country ranking';
    return 'Results';
  }
  if (pathname.includes('/event')) return 'Event';
  if (pathname.includes('/register')) return 'Registration';
  if (pathname.includes('/pilots/') || pathname.includes('/profile/')) return 'Pilot';
  if (pathname.includes('/pilots')) return 'Pilots';
  return '';
}

/** Per-route document meta for competition pages. */
export function CompetitionSeo() {
  const { pathname, search } = useLocation();
  const { data: competition } = useCompetition();
  const section = sectionTitle(pathname, search);

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
