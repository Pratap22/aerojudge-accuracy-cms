import { Badge, cn } from '@npha/ui';
import { padPilotNumber } from '@npha/utils';

interface OnDeckPilot {
  id: string;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  status: 'ON_DECK' | 'PENDING' | 'CURRENT' | 'SCORED';
}

interface OnDeckListProps {
  pilots: OnDeckPilot[];
  currentId: string | null;
  onSelect?: (flightId: string) => void;
  className?: string;
}

function formatPilotNo(n: number): string {
  return padPilotNumber(n, 2);
}

export function OnDeckList({ pilots, currentId, onSelect, className }: OnDeckListProps) {
  const current = pilots.find((p) => p.id === currentId);
  const upcoming = pilots.filter((p) => p.id !== currentId).slice(0, 8);

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Scoring
        </h3>
        {current ? (
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg bg-sky-600/30 px-4 py-3 ring-1 ring-sky-500"
            onClick={() => onSelect?.(current.id)}
          >
            <div className="flex items-center gap-3 text-left">
              <span className="font-mono text-lg font-bold text-sky-400">
                {formatPilotNo(current.pilotNumber)}
              </span>
              <span className="font-medium">
                {current.firstName} {current.lastName}
              </span>
            </div>
            <Badge variant="secondary">Scoring</Badge>
          </button>
        ) : (
          <p className="text-sm text-slate-500">Select a pilot</p>
        )}
      </div>

      {upcoming.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Switch pilot
          </h3>
          <div className="max-h-[28rem] space-y-1 overflow-y-auto">
            {upcoming.map((p) => (
              <button
                key={p.id}
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-4 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-slate-800 active:scale-[0.99]"
                onClick={() => onSelect?.(p.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sky-400">{formatPilotNo(p.pilotNumber)}</span>
                  <span>
                    {p.firstName} {p.lastName}
                  </span>
                </div>
                {p.status === 'SCORED' && (
                  <span className="text-xs text-slate-500">scored</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
