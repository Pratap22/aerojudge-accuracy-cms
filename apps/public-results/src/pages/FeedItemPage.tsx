import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { feedItemId } from '@aero-judge/utils';
import { Layout } from '../components/Layout';
import { ShareFeedButton } from '../components/EventFeed';
import { useCompetition } from '../hooks/useCompetition';
import { competitionPath, feedItemPath, fetchFeedItem, shareUrl } from '../lib/api';
import { useDocumentSeo } from '../lib/seo';

function oneLine(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function FeedItemPage() {
  const { competitionId = '', itemId: rawItemId = '' } = useParams<{
    competitionId: string;
    itemId: string;
  }>();
  const itemId = feedItemId(rawItemId);
  const navigate = useNavigate();
  useEffect(() => {
    if (competitionId && itemId && itemId !== rawItemId) {
      navigate(feedItemPath(competitionId, itemId), { replace: true });
    }
  }, [competitionId, itemId, rawItemId, navigate]);
  const { data: competition } = useCompetition();
  const { data: item, isLoading, error } = useQuery({
    queryKey: ['public-feed-item', competitionId, itemId],
    queryFn: () => fetchFeedItem(competitionId, itemId),
    enabled: Boolean(competitionId && itemId),
  });

  const place = [competition?.venue, competition?.country].filter(Boolean).join(', ');
  const headline =
    item?.kind === 'SCORE' && item.pilotName
      ? `${item.pilotName}${item.scoreText ? ` ${item.scoreText}` : ''}`
      : oneLine(item?.caption) || oneLine(item?.body) || 'Event update';
  const title = competition
    ? `${headline} — ${competition.name} · Paragliding Accuracy`
    : `${headline} · Paragliding Accuracy`;
  const description = competition
    ? `${headline}. ${competition.name} paragliding accuracy${place ? ` in ${place}` : ''}.`
    : headline;

  useDocumentSeo({
    title,
    description,
    url: competitionId && itemId ? shareUrl(feedItemPath(competitionId, itemId)) : undefined,
    image: item?.imageUrl || undefined,
  });

  return (
    <Layout seo="none">
      <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          to={`${competitionPath(competitionId, 'event')}#feed`}
          className="text-sm font-medium text-sky-700 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
        >
          ← Feed
        </Link>
        {isLoading ? <p className="mt-6 text-muted-foreground">Loading update…</p> : null}
        {error ? (
          <p className="mt-6 text-muted-foreground">This update is not available.</p>
        ) : null}
        {item ? (
          <>
            <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  {competition?.name ?? 'Paragliding accuracy'}
                </p>
                <h1 className="mt-2 font-display text-3xl font-bold text-foreground">{headline}</h1>
                <time dateTime={item.createdAt} className="mt-2 block text-sm text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString()}
                </time>
              </div>
              {item.imageUrl ? <ShareFeedButton competitionId={competitionId} item={item} /> : null}
            </header>
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={headline}
                className="mx-auto mt-6 block h-auto max-h-[40rem] w-auto max-w-full rounded-2xl"
              />
            ) : null}
            {item.kind !== 'SCORE' && (item.caption || item.body) ? (
              <p className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-foreground">
                {item.kind === 'PHOTO' ? item.caption || item.body : item.body}
              </p>
            ) : null}
            {item.kind === 'SCORE' && item.scoreText ? (
              <p className="mt-6 text-2xl font-semibold tabular-nums text-foreground">{item.scoreText}</p>
            ) : null}
          </>
        ) : null}
      </article>
    </Layout>
  );
}
