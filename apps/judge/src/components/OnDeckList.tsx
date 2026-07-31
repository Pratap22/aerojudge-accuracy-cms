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
  const upcoming = pilots
    .filter((p) => p.id !== currentId)
    .slice()
    .sort((a, b) => a.pilotNumber - b.pilotNumber);

  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-3', className)}>
      <div className="shrink-0">
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Scoring
        </h3>
        {current ? (
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg bg-sky-600/30 px-3 py-2 ring-1 ring-sky-500"
            onClick={() => onSelect?.(current.id)}
          >
            <div className="flex min-w-0 items-center gap-2 text-left">
              <span className="font-mono text-base font-bold text-sky-400">
                {formatPilotNo(current.pilotNumber)}
              </span>
              <span className="truncate text-sm font-medium">
                {current.firstName} {current.lastName}
              </span>
            </div>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              Scoring
            </Badge>
          </button>
        ) : (
          <p className="text-sm text-slate-500">Select a pilot</p>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <h3 className="mb-1.5 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Switch pilot
        </h3>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain pr-1">
          {upcoming.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm text-slate-300 transition-colors hover:bg-slate-800 active:scale-[0.99]"
              onClick={() => onSelect?.(p.id)}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-sky-400">{formatPilotNo(p.pilotNumber)}</span>
                <span className="truncate">
                  {p.firstName} {p.lastName}
                </span>
              </div>
              {p.status === 'SCORED' && (
                <span className="shrink-0 text-[10px] text-slate-500">scored</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
