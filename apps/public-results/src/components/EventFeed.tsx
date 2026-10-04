import { Link } from 'react-router-dom';
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
        className="h-14 w-14 shrink-0 rounded-full object-cover object-top ring-1 ring-white/15"
      />
    );
  }
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-500 font-display text-xl font-bold text-white">
      {pilotNumber ?? '·'}
    </span>
  );
}

function FeedCard({ item }: { item: PublicFeedItem }) {
  const isPilotPost = item.kind === 'SCORE' || item.kind === 'REFLIGHT';
  const heading =
    isPilotPost && item.roundNumber != null ? `Round ${item.roundNumber}` : kindLabel(item.kind);

  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-wide text-sky-300/60">
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
        <div className="mt-4 flex items-center gap-4">
          <PilotFace photoUrl={item.pilotPhotoUrl} pilotNumber={item.pilotNumber} />
          <div className="min-w-0 flex-1">
            {item.pilotName ? (
              <p className="truncate text-lg font-semibold text-white">
                {item.pilotPhotoUrl && item.pilotNumber != null ? (
                  <span className="mr-2 font-mono text-base text-sky-400">#{item.pilotNumber}</span>
                ) : null}
                {item.pilotName}
              </p>
            ) : null}
            {item.kind === 'REFLIGHT' ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-snug text-white">
                {item.reason || 'Reflight'}
              </p>
            ) : null}
          </div>
          {item.kind === 'SCORE' && item.scoreText ? (
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-medium uppercase tracking-wider text-sky-300/60">Score</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-white">{item.scoreText}</p>
            </div>
          ) : null}
          {item.kind === 'REFLIGHT' ? (
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-medium uppercase tracking-wider text-sky-300/60">Result</p>
              <p className="text-lg font-semibold text-white">Reflight</p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-white">
          {item.kind === 'PHOTO' ? item.caption || item.body : item.body}
        </p>
      )}
    </li>
  );
}

export function EventFeedList({ items }: { items: PublicFeedItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-sky-200/60">No updates yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
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
    <section className="mx-auto max-w-7xl px-6 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">Feed</h2>
        <Link
          to={competitionPath(competitionId, 'feed')}
          className="text-sm font-medium text-sky-400 hover:text-sky-300"
        >
          All updates →
        </Link>
      </div>
      <div className="mt-6">
        <EventFeedList items={preview} />
      </div>
    </section>
  );
}
