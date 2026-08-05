import type { ScoreResultType } from '@npha/shared';
import { Badge, cn } from '@npha/ui';
import { formatScoreCm, padPilotNumber } from '@npha/utils';

interface OnDeckPilot {
  id: string;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  status: 'ON_DECK' | 'PENDING' | 'CURRENT' | 'SCORED';
  distanceCm?: number | null;
  resultType?: ScoreResultType | null;
  finalScoreCm?: number | null;
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

/** Compact score label for the switch-pilot list. */
function formatDeckScore(p: OnDeckPilot): string | null {
  const type = p.resultType;
  const hasScore =
    p.status === 'SCORED' || type != null || p.finalScoreCm != null || p.distanceCm != null;
  if (!hasScore) return null;

  if (type === 'BULLSEYE' || (p.distanceCm === 0 && type === 'MEASURED')) {
    return '0';
  }
  if (type && type !== 'MEASURED' && type !== 'MAXIMUM') {
    return type;
  }
  if (p.finalScoreCm != null) return formatScoreCm(p.finalScoreCm);
  if (p.distanceCm != null) return formatScoreCm(p.distanceCm);
  return '—';
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
        <div className="mb-1 grid shrink-0 grid-cols-[2.5rem_minmax(0,1fr)_auto_3.25rem] gap-x-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <span>#</span>
          <span>Pilot</span>
          <span className="text-right">Status</span>
          <span className="text-right">Score</span>
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain pr-1">
          {upcoming.map((p) => {
            const scoreLabel = formatDeckScore(p);
            const isScored = scoreLabel != null;
            return (
              <button
                key={p.id}
                type="button"
                className="grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto_3.25rem] items-center gap-x-2 rounded-lg px-3 py-1.5 text-left text-sm text-slate-300 transition-colors hover:bg-slate-800 active:scale-[0.99]"
                onClick={() => onSelect?.(p.id)}
              >
                <span className="font-mono text-sky-400">{formatPilotNo(p.pilotNumber)}</span>
                <span className="truncate">
                  {p.firstName} {p.lastName}
                </span>
                <span className="shrink-0 text-right text-[10px] text-slate-500">
                  {isScored ? 'scored' : ''}
                </span>
                <span
                  className={cn(
                    'shrink-0 text-right font-mono text-xs tabular-nums',
                    isScored ? 'font-semibold text-sky-300' : 'text-slate-600',
                  )}
                >
                  {scoreLabel ?? '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
