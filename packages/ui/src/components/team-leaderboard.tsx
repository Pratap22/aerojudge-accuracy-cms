import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { formatScoreCm } from '@aero-judge/utils';

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
  /** Full browser path to the pilot profile, including the app base. */
  profileHref?: string;
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

function usePhoneLayout() {
  const query = '(max-width: 767px)';
  const [matches, setMatches] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  React.useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return matches;
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
        'inline-flex min-w-[2rem] items-center justify-center rounded px-0 py-0.5 font-mono text-xs tabular-nums sm:min-w-[2.25rem] sm:px-1 sm:text-sm',
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
    <span className="inline-flex min-w-[2.25rem] items-center justify-center rounded-md bg-foreground px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-background sm:min-w-[2.75rem] sm:px-2 sm:text-sm">
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

  const phone = usePhoneLayout();
  const dense = compact || (phone && roundNumbers.length > 0);
  const detail = roundNumbers.length > 0;
  // Phone widths: expand, rank, team, and total stay put; rounds use whatever is left.
  const frozen = 'max-md:sticky max-md:z-20 max-md:!px-1 max-md:py-2 max-md:bg-card';
  const toggleCol = detail
    ? 'w-[var(--tb-toggle)] min-w-[var(--tb-toggle)] max-w-[var(--tb-toggle)] md:w-10 md:min-w-10 md:max-w-none'
    : cn('w-10', compact && 'w-8');
  const rankCol = detail
    ? 'w-[var(--tb-rank)] min-w-[var(--tb-rank)] max-w-[var(--tb-rank)] max-md:left-[var(--tb-toggle)] md:w-16 md:min-w-16 md:max-w-none'
    : cn('w-16', compact && 'w-12');
  const teamCol = detail
    ? 'max-md:left-[calc(var(--tb-toggle)+var(--tb-rank))] max-md:w-[var(--tb-team)] max-md:min-w-[var(--tb-team)] max-md:max-w-[var(--tb-team)] max-md:border-r max-md:border-border'
    : '';
  const scoreCol = detail
    ? 'max-md:left-[calc(var(--tb-toggle)+var(--tb-rank)+var(--tb-team))] max-md:w-[var(--tb-score)] max-md:min-w-[var(--tb-score)] max-md:max-w-[var(--tb-score)] max-md:border-r max-md:border-border'
    : '';
  const freeze = (col: string) => cn(detail && frozen, col);
  const roundHeadClass = '!px-0 text-center tabular-nums max-md:w-8 md:min-w-[2.75rem] md:!px-1 md:w-auto';
  const roundCellClass = '!px-0 text-center md:!px-1';

  return (
    <div
      className={cn(
        'w-max min-w-full',
        detail && '[--tb-rank:2.75rem] [--tb-score:3.25rem] [--tb-team:8rem] [--tb-toggle:2rem]',
        className,
      )}
      {...props}
    >
      <Table
        containerClassName="overflow-visible"
        className="w-max min-w-full border-separate border-spacing-0"
      >
        <TableHeader>
          <TableRow>
            <TableHead className={cn(freeze(toggleCol), 'max-md:left-0')} aria-label="Expand" />
            <TableHead className={freeze(rankCol)}>Rank</TableHead>
            <TableHead className={freeze(teamCol)}>Team</TableHead>
            <TableHead className={cn(freeze(scoreCol), 'text-right')}>Score</TableHead>
            {roundNumbers.map((n) => (
              <TableHead key={n} className={roundHeadClass}>
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
                  <TableCell className={cn(freeze(toggleCol), 'max-md:left-0')}>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                        open && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </TableCell>
                  <TableCell className={freeze(rankCol)}>
                    <RankBadge rank={entry.rank} size={dense ? 'sm' : 'default'} />
                  </TableCell>
                  <TableCell className={freeze(teamCol)}>
                    <div
                      className={
                        detail
                          ? 'flex max-md:w-[calc(var(--tb-team)-0.5rem)] max-md:max-w-[calc(var(--tb-team)-0.5rem)] min-w-0 items-center gap-2 overflow-hidden font-medium'
                          : 'inline-flex items-center gap-2 font-medium'
                      }
                    >
                      {flagEmoji && (
                        <span className="shrink-0 text-base leading-none" aria-hidden>
                          {flagEmoji}
                        </span>
                      )}
                      <span className="min-w-0 truncate">{entry.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className={cn(freeze(scoreCol), 'text-right')}>
                    <ScorePill value={entry.totalScoreCm} />
                  </TableCell>
                  {roundNumbers.map((n) => (
                    <TableCell key={n} className={roundCellClass}>
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
                      <TableCell className={cn(freeze(toggleCol), 'max-md:left-0')} />
                      <TableCell className={freeze(rankCol)} />
                      <TableCell className={freeze(teamCol)}>
                        <div
                          className={
                            detail
                              ? 'max-md:w-[calc(var(--tb-team)-0.5rem)] max-md:max-w-[calc(var(--tb-team)-0.5rem)] max-md:overflow-hidden'
                              : undefined
                          }
                        >
                          {pilot.profileHref ? (
                            <a
                              href={pilot.profileHref}
                              className="flex w-full min-w-0 max-w-full rounded-lg outline-offset-2 hover:bg-muted/70"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <PilotChip
                                pilotNumber={pilot.pilotNumber}
                                firstName={pilot.firstName}
                                lastName={pilot.lastName}
                                photoUrl={pilot.photoUrl}
                                size={dense ? 'sm' : 'default'}
                                className={
                                  detail
                                    ? 'max-md:w-full max-md:!gap-x-1.5 max-md:[&_[data-pilot-photo]]:h-8 max-md:[&_[data-pilot-photo]]:w-8'
                                    : undefined
                                }
                              />
                            </a>
                          ) : (
                            <PilotChip
                              pilotNumber={pilot.pilotNumber}
                              firstName={pilot.firstName}
                              lastName={pilot.lastName}
                              photoUrl={pilot.photoUrl}
                              size={dense ? 'sm' : 'default'}
                              className={
                                detail
                                  ? 'max-md:w-full max-md:!gap-x-1.5 max-md:[&_[data-pilot-photo]]:h-8 max-md:[&_[data-pilot-photo]]:w-8'
                                  : undefined
                              }
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={freeze(scoreCol)} />
                      {roundNumbers.map((n) => (
                        <TableCell key={n} className={roundCellClass}>
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
                    <TableCell className={cn(freeze(toggleCol), 'max-md:left-0')} />
                    <TableCell className={freeze(rankCol)} />
                    <TableCell className={cn(freeze(teamCol), 'text-right text-muted-foreground')}>
                      <span className="block truncate">Round total</span>
                    </TableCell>
                    <TableCell className={freeze(scoreCol)} />
                    {roundNumbers.map((n) => (
                      <TableCell key={n} className={roundCellClass}>
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
