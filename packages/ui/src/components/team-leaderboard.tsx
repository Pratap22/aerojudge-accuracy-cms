import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { formatScoreCm } from '@npha/utils';

import { cn } from '../lib/utils';
import { PilotChip } from './pilot-chip';
import { RankBadge } from './rank-badge';
import type { LeaderboardRoundScore } from './leaderboard-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

export interface TeamLeaderboardPilot {
  pilotId: string;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  role?: string;
  photoUrl?: string | null;
  roundScores: LeaderboardRoundScore[];
}

export interface TeamLeaderboardEntry {
  rank: number;
  teamId: string;
  name: string;
  countryCode2?: string;
  totalScoreCm: number;
  roundScores: LeaderboardRoundScore[];
  pilots: TeamLeaderboardPilot[];
}

export interface TeamLeaderboardProps extends React.HTMLAttributes<HTMLDivElement> {
  entries: TeamLeaderboardEntry[];
  roundNumbers?: number[];
  compact?: boolean;
  highlightPodium?: boolean;
  /** Open first team by default (false = all collapsed) */
  defaultOpenFirst?: boolean;
}

function toFlagEmoji(code2: string | undefined): string | null {
  if (!code2) return null;
  const upper = code2.trim().toUpperCase();
  if (upper.length !== 2 || upper === 'XX' || !/^[A-Z]{2}$/.test(upper)) return null;
  return String.fromCodePoint(...upper.split('').map((c) => 127397 + c.charCodeAt(0)));
}

function scoreByRound(
  scores: LeaderboardRoundScore[] | undefined,
  round: number,
): LeaderboardRoundScore | undefined {
  return scores?.find((rs) => rs.round === round);
}

function RoundScoreCell({
  cell,
  discardedTitle = 'Discarded (not counted in total)',
}: {
  cell: LeaderboardRoundScore | undefined;
  discardedTitle?: string;
}) {
  const empty = cell == null || cell.scoreCm == null;
  const discarded = Boolean(cell?.isDiscarded);
  const provisional = Boolean(cell?.isProvisional);

  return (
    <span
      className={cn(
        'inline-flex min-w-[2.25rem] items-center justify-center rounded px-1 py-0.5 font-mono text-xs tabular-nums sm:text-sm',
        empty && 'bg-muted/40 text-muted-foreground/50',
        !empty && discarded && 'text-red-500 line-through decoration-2 decoration-red-500',
        !empty && provisional && !discarded && 'text-muted-foreground/70',
        !empty &&
          cell?.isBullseye &&
          !discarded &&
          'font-semibold text-[hsl(var(--score-bullseye))]',
        !empty && !discarded && !provisional && !cell?.isBullseye && 'text-foreground',
      )}
      title={
        discarded
          ? discardedTitle
          : provisional
            ? 'Provisional (not yet scored)'
            : undefined
      }
    >
      {empty ? '·' : formatScoreCm(cell.scoreCm)}
    </span>
  );
}

function ScorePill({ value }: { value: number }) {
  return (
    <span className="inline-flex min-w-[2.75rem] items-center justify-center rounded-md bg-foreground px-2 py-0.5 font-mono text-sm font-semibold tabular-nums text-background">
      {formatScoreCm(value)}
    </span>
  );
}

export function TeamLeaderboard({
  entries,
  roundNumbers: roundNumbersProp,
  compact = false,
  highlightPodium = true,
  defaultOpenFirst = false,
  className,
  ...props
}: TeamLeaderboardProps) {
  const roundNumbers = React.useMemo(() => {
    if (roundNumbersProp?.length) return [...roundNumbersProp].sort((a, b) => a - b);
    const set = new Set<number>();
    for (const entry of entries) {
      for (const rs of entry.roundScores ?? []) {
        if (rs.round > 0) set.add(rs.round);
      }
      for (const pilot of entry.pilots ?? []) {
        for (const rs of pilot.roundScores ?? []) {
          if (rs.round > 0) set.add(rs.round);
        }
      }
    }
    return [...set].sort((a, b) => a - b);
  }, [entries, roundNumbersProp]);

  const [openIds, setOpenIds] = React.useState<Set<string>>(() => {
    if (!defaultOpenFirst || entries.length === 0) return new Set();
    return new Set([entries[0].teamId]);
  });

  const toggle = (teamId: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  return (
    <div className={cn('w-full', className)} {...props}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={cn('w-10', compact && 'w-8')} aria-label="Expand" />
            <TableHead className={cn('w-16', compact && 'w-12')}>Rank</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-right">Score</TableHead>
            {roundNumbers.map((n) => (
              <TableHead key={n} className="min-w-[2.75rem] px-1 text-center tabular-nums">
                {n}.
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const open = openIds.has(entry.teamId);
            const flagEmoji = toFlagEmoji(entry.countryCode2);
            const colSpan = 4 + roundNumbers.length;

            return (
              <React.Fragment key={entry.teamId}>
                <TableRow
                  className={cn(
                    'cursor-pointer',
                    highlightPodium && entry.rank <= 3 && 'font-medium',
                    open && 'bg-accent/5',
                  )}
                  onClick={() => toggle(entry.teamId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggle(entry.teamId);
                    }
                  }}
                  tabIndex={0}
                  aria-expanded={open}
                  data-state={open ? 'open' : 'closed'}
                >
                  <TableCell className="px-2">
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                        open && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </TableCell>
                  <TableCell>
                    <RankBadge rank={entry.rank} size={compact ? 'sm' : 'default'} />
                  </TableCell>
                  <TableCell>
                    <div className="inline-flex items-center gap-2 font-medium">
                      {flagEmoji && (
                        <span className="text-base leading-none" aria-hidden>
                          {flagEmoji}
                        </span>
                      )}
                      <span>{entry.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <ScorePill value={entry.totalScoreCm} />
                  </TableCell>
                  {roundNumbers.map((n) => (
                    <TableCell key={n} className="px-1 text-center">
                      <RoundScoreCell
                        cell={scoreByRound(entry.roundScores, n)}
                        discardedTitle="Discarded team round (not counted in total)"
                      />
                    </TableCell>
                  ))}
                </TableRow>

                {open &&
                  entry.pilots.map((pilot) => (
                    <TableRow
                      key={`${entry.teamId}-${pilot.pilotId}`}
                      className="bg-muted/20 hover:bg-muted/30"
                    >
                      <TableCell />
                      <TableCell />
                      <TableCell>
                        <PilotChip
                          pilotNumber={pilot.pilotNumber}
                          firstName={pilot.firstName}
                          lastName={pilot.lastName}
                          photoUrl={pilot.photoUrl}
                          size={compact ? 'sm' : 'default'}
                        />
                      </TableCell>
                      <TableCell />
                      {roundNumbers.map((n) => (
                        <TableCell key={n} className="px-1 text-center">
                          <RoundScoreCell
                            cell={scoreByRound(pilot.roundScores, n)}
                            discardedTitle="Not counted toward team total this round"
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {open && entry.pilots.length > 0 && (
                  <TableRow className="border-b-2 bg-muted/30 font-medium">
                    <TableCell colSpan={3} className="text-right text-muted-foreground">
                      Round total
                    </TableCell>
                    <TableCell />
                    {roundNumbers.map((n) => (
                      <TableCell key={n} className="px-1 text-center">
                        <RoundScoreCell
                          cell={scoreByRound(entry.roundScores, n)}
                          discardedTitle="Discarded team round (not counted in total)"
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                )}

                {open && entry.pilots.length === 0 && (
                  <TableRow className="bg-muted/20">
                    <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
                      No pilots on this team.
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
