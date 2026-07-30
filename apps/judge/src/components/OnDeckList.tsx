import { Badge, cn } from '@npha/ui';

interface OnDeckPilot {
  id: string;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  status: 'ON_DECK' | 'PENDING' | 'CURRENT';
}

interface OnDeckListProps {
  pilots: OnDeckPilot[];
  currentId: string | null;
  className?: string;
}

export function OnDeckList({ pilots, currentId, className }: OnDeckListProps) {
  const onDeck = pilots.filter((p) => p.status === 'ON_DECK' || p.id === currentId);
  const upcoming = pilots.filter((p) => p.status === 'PENDING').slice(0, 5);

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">On Deck</h3>
        <div className="space-y-2">
          {onDeck.length === 0 ? (
            <p className="text-sm text-slate-500">No pilots on deck</p>
          ) : (
            onDeck.map((p) => (
              <div
                key={p.id}
                className={cn(
                  'flex items-center justify-between rounded-lg px-4 py-3',
                  p.id === currentId ? 'bg-sky-600/30 ring-1 ring-sky-500' : 'bg-slate-800',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg font-bold text-sky-400">{p.pilotNumber}</span>
                  <span className="font-medium">
                    {p.firstName} {p.lastName}
                  </span>
                </div>
                {p.id === currentId && <Badge variant="secondary">Scoring</Badge>}
                {p.status === 'ON_DECK' && p.id !== currentId && (
                  <Badge variant="warning">On Deck</Badge>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {upcoming.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Up Next</h3>
          <div className="space-y-1">
            {upcoming.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm text-slate-400">
                <span className="font-mono">{p.pilotNumber}</span>
                <span>
                  {p.firstName} {p.lastName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
