import { Layout } from '../components/Layout';
import { EventFeedList } from '../components/EventFeed';
import { useEventFeed } from '../hooks/useCompetition';

export function FeedPage() {
  const { data: items = [], isLoading, error } = useEventFeed();

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8 border-b border-white/15 pb-3">
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Feed</h1>
          <p className="mt-2 text-sm text-sky-300/70">Scores, reflights, and photos from this event</p>
        </div>
        {isLoading ? <p className="text-sm text-sky-200/60">Loading updates…</p> : null}
        {error ? <p className="text-sm text-rose-300">Updates are unavailable right now.</p> : null}
        {!isLoading && !error ? <EventFeedList items={items} /> : null}
      </div>
    </Layout>
  );
}
