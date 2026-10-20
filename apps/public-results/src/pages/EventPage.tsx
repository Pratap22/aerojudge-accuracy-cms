import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { CompetitionInfoSections } from '../components/CompetitionInfoSections';
import { EventFeedList } from '../components/EventFeed';
import { OfficialCard, OrganizerCard } from '../components/OrganizingTeam';
import { FaiCategoryBadge } from '../components/FaiCategoryBadge';
import { useCompetition, useEventFeed } from '../hooks/useCompetition';
import { competitionPath, fetchEventInfo, fetchOfficials } from '../lib/api';

const SECTIONS = [
  { id: 'feed', label: 'Feed' },
  { id: 'info', label: 'Info' },
  { id: 'officials', label: 'Officials' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

function sectionFromHash(hash: string): SectionId {
  const id = hash.replace(/^#/, '');
  return SECTIONS.some((section) => section.id === id) ? (id as SectionId) : 'feed';
}

export function EventPage() {
  const { competitionId = '' } = useParams<{ competitionId: string }>();
  const location = useLocation();
  const { data: competition, isLoading: competitionLoading } = useCompetition();
  const { data: feed = [], isLoading: feedLoading, error: feedError } = useEventFeed();
  const { data: info, isLoading: infoLoading } = useQuery({
    queryKey: ['public-event-info', competitionId],
    queryFn: () => fetchEventInfo(competitionId),
    enabled: Boolean(competitionId),
  });
  const {
    data: officials = [],
    isLoading: officialsLoading,
    error: officialsError,
  } = useQuery({
    queryKey: ['public-officials', competitionId],
    queryFn: () => fetchOfficials(competitionId),
    enabled: Boolean(competitionId),
  });

  const organiser = competition?.organiser;
  const hasOrganiser = Boolean(organiser?.name);
  const ready = !competitionLoading && !feedLoading && !infoLoading && !officialsLoading;
  const section = sectionFromHash(location.hash);
  const eventPath = competitionPath(competitionId, 'event');

  useEffect(() => {
    if (!ready) return;
    const target = document.getElementById(section);
    if (!target) return;
    const top = target.getBoundingClientRect().top;
    if (top < 80 || top > window.innerHeight * 0.4) {
      target.scrollIntoView();
    }
  }, [ready, section]);

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

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <header className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-wider text-sky-400/70">Event</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-4xl font-bold text-white">
              {competition?.name ?? 'Event'}
            </h1>
            <FaiCategoryBadge value={competition?.faiCategory} />
          </div>
          {competition ? (
            <p className="mt-3 text-sky-100/55">
              {[competition.venue, competition.country].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </header>

        <div className="mt-8 flex flex-wrap gap-2">
          {SECTIONS.map((item) => {
            const active = item.id === section;
            return (
              <Link
                key={item.id}
                to={`${eventPath}#${item.id}`}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-[#050d1a]'
                    : 'rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-sky-100/80 transition-colors hover:bg-white/10 hover:text-white'
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {section === 'feed' ? (
        <section id="feed" className="scroll-mt-28 py-10">
          <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">Feed</h2>
          <p className="mt-2 text-sm text-sky-300/70">Scores, reflights, and photos from this event</p>
          <div className="mt-6 max-w-3xl">
            {feedLoading ? <p className="text-sm text-sky-200/60">Loading updates…</p> : null}
            {feedError ? <p className="text-sm text-rose-300">Updates are unavailable right now.</p> : null}
            {!feedLoading && !feedError ? <EventFeedList items={feed} /> : null}
          </div>
        </section>
        ) : null}

        {section === 'info' ? (
        <section id="info" className="scroll-mt-28 py-10">
          <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">Info</h2>
          <div className="mt-6">
            {infoLoading ? <p className="text-sm text-sky-200/60">Loading event info…</p> : null}
            {!infoLoading && info?.hasContent ? <CompetitionInfoSections info={info} /> : null}
            {!infoLoading && !info?.hasContent ? (
              <p className="text-sky-300/70">Detailed event information has not been published yet.</p>
            ) : null}
          </div>
        </section>
        ) : null}

        {section === 'officials' ? (
        <section id="officials" className="scroll-mt-28 py-10">
          <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">Officials</h2>
          <p className="mt-2 text-sm text-sky-300/70">Judges and officials for this competition</p>
          <div className="mt-6">
            {officialsLoading ? <p className="text-sky-400/60">Loading organizing team…</p> : null}
            {officialsError ? (
              <p className="text-red-400">
                {officialsError instanceof Error ? officialsError.message : 'Could not load team'}
              </p>
            ) : null}
            {!officialsLoading && !officialsError && officials.length === 0 && !hasOrganiser ? (
              <p className="text-sky-300/70">No organizing team listed yet.</p>
            ) : null}
            {!officialsLoading && !officialsError && (officials.length > 0 || hasOrganiser) ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {hasOrganiser && organiser ? <OrganizerCard organiser={organiser} index={0} /> : null}
                {officials.map((official, index) => (
                  <OfficialCard
                    key={official.id}
                    official={official}
                    showContact
                    index={index + (hasOrganiser ? 1 : 0)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </section>
        ) : null}

        <p className="border-t border-white/10 pt-8">
          <Link to={competitionPath(competitionId)} className="text-sm font-medium text-sky-400 hover:text-sky-300">
            Back to home
          </Link>
        </p>
      </div>
    </Layout>
  );
}
