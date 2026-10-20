import { Link } from 'react-router-dom';
import { padPilotNumber } from '@aero-judge/utils';
import { competitionPath, type PublicFeedItem } from '../lib/api';

function kindLabel(kind: PublicFeedItem['kind']): string {
  if (kind === 'SCORE') return 'Score';
  if (kind === 'REFLIGHT') return 'Reflight';
  if (kind === 'TEXT') return 'Update';
  return 'Photo';
}

function PilotFace({
  photoUrl,
  pilotNumber,
}: {
  photoUrl: string | null;
  pilotNumber: number | null;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover object-top ring-1 ring-border"
      />
    );
  }
  return (
    <span className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 px-1.5 font-mono text-xs font-bold tabular-nums text-foreground">
      {pilotNumber != null ? padPilotNumber(pilotNumber) : '·'}
    </span>
  );
}

function FeedCard({ item }: { item: PublicFeedItem }) {
  const isPilotPost = item.kind === 'SCORE' || item.kind === 'REFLIGHT';
  const heading =
    isPilotPost && item.roundNumber != null ? `Round ${item.roundNumber}` : kindLabel(item.kind);

  return (
    <li className="rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>{heading}</span>
        <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
      </div>

      {item.kind === 'PHOTO' && item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.caption ?? item.body}
          className="mt-3 max-h-[28rem] w-full rounded-xl object-cover"
        />
      ) : null}

      {isPilotPost ? (
        <div className="mt-2 flex items-center gap-3">
          <PilotFace photoUrl={item.pilotPhotoUrl} pilotNumber={item.pilotNumber} />
          <div className="min-w-0 flex-1">
            {item.pilotName ? (
              <p className="truncate font-semibold text-foreground">
                {item.pilotPhotoUrl && item.pilotNumber != null ? (
                  <span className="mr-2 font-mono text-sm text-sky-700 dark:text-sky-400">
                    #{padPilotNumber(item.pilotNumber)}
                  </span>
                ) : null}
                {item.pilotName}
              </p>
            ) : null}
            {item.kind === 'REFLIGHT' ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-snug text-foreground">
                {item.reason || 'Reflight'}
              </p>
            ) : null}
          </div>
          {item.kind === 'SCORE' && item.scoreText ? (
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Score</p>
              <p className="text-lg font-semibold tabular-nums tracking-tight text-foreground">{item.scoreText}</p>
            </div>
          ) : null}
          {item.kind === 'REFLIGHT' ? (
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Result</p>
              <p className="text-lg font-semibold text-foreground">Reflight</p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-foreground">
          {item.kind === 'PHOTO' ? item.caption || item.body : item.body}
        </p>
      )}
    </li>
  );
}

export function EventFeedList({ items }: { items: PublicFeedItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No updates yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-2">
      {items.map((item) => (
        <FeedCard key={item.id} item={item} />
      ))}
    </ol>
  );
}

export function EventFeedPreview({
  competitionId,
  items,
}: {
  competitionId: string;
  items: PublicFeedItem[];
}) {
  const preview = items.slice(0, 4);
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">Feed</h2>
        <Link
          to={`${competitionPath(competitionId, 'event')}#feed`}
          className="text-sm font-medium text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300"
        >
          All updates →
        </Link>
      </div>
      <div className="mt-3">
        <EventFeedList items={preview} />
      </div>
    </section>
  );
}
