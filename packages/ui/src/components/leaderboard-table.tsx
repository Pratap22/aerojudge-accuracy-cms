import * as React from 'react';
import { formatScoreCm } from '@npha/utils';

import { cn } from '../lib/utils';
import { PilotChip } from './pilot-chip';
import { RankBadge } from './rank-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

export interface LeaderboardRoundScore {
  round: number;
  scoreCm: number | null;
  isBullseye?: boolean;
  /** Worst-round discard — excluded from total; shown with strikethrough */
  isDiscarded?: boolean;
  /** Unflown live fill; muted in the grid */
  isProvisional?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  /** When set, shown instead of first/last name (teams, countries) */
  displayName?: string;
  /** ISO 3166-1 alpha-2 for flag emoji */
  countryCode2?: string;
  /** Display name of the country (optional) */
  countryName?: string;
  flagUrl?: string;
  /** Total score in cm (lower is better) */
  totalScoreCm: number;
  roundsFlown?: number;
  /** Competition scoring rounds total for "8/9" style display */
  roundsTotal?: number;
  bullseyes?: number;
  /** Per-round scores for multi-column leaderboards */
  roundScores?: LeaderboardRoundScore[];
  /** Highlight row e.g. current pilot */
  isHighlighted?: boolean;
  /** Hide pilot-number badge (teams / countries) */
  hideNumber?: boolean;
}

export interface LeaderboardTableProps extends React.HTMLAttributes<HTMLDivElement> {
  entries: LeaderboardEntry[];
  title?: string;
  /** Column header for the name column */
  nameColumn?: string;
  showBullseyes?: boolean;
  showRounds?: boolean;
  /**
   * Show one column per round (score detail). When enabled, discarded scores
   * are struck through like classic live leaderboards.
   */
  showRoundScores?: boolean;
  /**
   * Round numbers for column headers. Derived from entries when omitted.
   */
  roundNumbers?: number[];
  compact?: boolean;
  /** Highlight top N ranks with podium styling */
  highlightPodium?: boolean;
}

/** ISO 3166-1 alpha-2 suitable for flag emoji (excludes placeholder XX). */
function toFlagEmoji(code2: string | undefined): string | null {
  if (!code2) return null;
  const upper = code2.trim().toUpperCase();
  if (upper.length !== 2 || upper === 'XX' || !/^[A-Z]{2}$/.test(upper)) return null;
  return String.fromCodePoint(...upper.split('').map((c) => 127397 + c.charCodeAt(0)));
}

function deriveRoundNumbers(entries: LeaderboardEntry[]): number[] {
  const set = new Set<number>();
  for (const entry of entries) {
    for (const rs of entry.roundScores ?? []) {
      if (rs.round > 0) set.add(rs.round);
    }
  }
  return [...set].sort((a, b) => a - b);
}

function scoreByRound(
  entry: LeaderboardEntry,
  round: number,
): LeaderboardRoundScore | undefined {
  return entry.roundScores?.find((rs) => rs.round === round);
}

export function LeaderboardTable({
  entries,
  title,
  nameColumn = 'Pilot',
  showBullseyes = true,
  showRounds = true,
  showRoundScores = false,
  roundNumbers: roundNumbersProp,
  compact = false,
  highlightPodium = true,
  className,
  ...props
}: LeaderboardTableProps) {
  const roundNumbers = React.useMemo(() => {
    if (!showRoundScores) return [];
    if (roundNumbersProp?.length) return [...roundNumbersProp].sort((a, b) => a - b);
    return deriveRoundNumbers(entries);
  }, [showRoundScores, roundNumbersProp, entries]);

  const detailMode = showRoundScores && roundNumbers.length > 0;
  // When rounds are expanded, "9/9" is redundant unless callers keep it on.
  const showRoundsCount = showRounds && !detailMode;

  return (
    <div className={cn('w-full', className)} {...props}>
      {title && (
        <h3 className="mb-4 text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={cn('w-16', compact && 'w-12')}>Rank</TableHead>
            <TableHead>{nameColumn}</TableHead>
            {showRoundsCount && (
              <TableHead className="hidden text-right sm:table-cell">Rounds</TableHead>
            )}
            {showBullseyes && (
              <TableHead className="hidden text-right md:table-cell">Bullseyes</TableHead>
            )}
            <TableHead className="text-right">{detailMode ? 'Score' : 'Total (cm)'}</TableHead>
            {detailMode &&
              roundNumbers.map((n) => (
                <TableHead
                  key={n}
                  className="min-w-[2.75rem] px-1 text-center tabular-nums"
                >
                  {n}.
                </TableHead>
              ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const label =
              entry.displayName ??
              `${entry.firstName}${entry.lastName ? ` ${entry.lastName}` : ''}`.trim();
            const flagEmoji = toFlagEmoji(entry.countryCode2);
            const roundsLabel =
              entry.roundsFlown == null
                ? '—'
                : entry.roundsTotal != null && entry.roundsTotal > 0
                  ? `${entry.roundsFlown}/${entry.roundsTotal}`
                  : String(entry.roundsFlown);
            return (
              <TableRow
                key={`${entry.rank}-${entry.pilotNumber}-${label}`}
                data-state={entry.isHighlighted ? 'selected' : undefined}
                className={cn(
                  entry.isHighlighted && 'bg-accent/10',
                  highlightPodium && entry.rank <= 3 && 'font-medium',
                )}
              >
                <TableCell>
                  <RankBadge rank={entry.rank} size={compact ? 'sm' : 'default'} />
                </TableCell>
                <TableCell>
                  {entry.hideNumber ? (
                    <div className="inline-flex items-center gap-2 font-medium">
                      {flagEmoji && (
                        <span className="text-base leading-none" aria-hidden>
                          {flagEmoji}
                        </span>
                      )}
                      <span>{label}</span>
                    </div>
                  ) : (
                    <PilotChip
                      pilotNumber={entry.pilotNumber}
                      firstName={entry.firstName}
                      lastName={entry.lastName}
                      countryCode2={entry.countryCode2}
                      flagUrl={entry.flagUrl}
                      size={compact ? 'sm' : 'default'}
                    />
                  )}
                </TableCell>
                {showRoundsCount && (
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {roundsLabel}
                  </TableCell>
                )}
                {showBullseyes && (
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {entry.bullseyes ?? '—'}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <span
                    className={cn(
                      'font-mono font-semibold tabular-nums',
                      detailMode &&
                        'inline-flex min-w-[2.75rem] items-center justify-center rounded-md bg-foreground px-2 py-0.5 text-background',
                      entry.totalScoreCm === 0 && !detailMode && 'text-[hsl(var(--score-bullseye))]',
                    )}
                  >
                    {formatScoreCm(entry.totalScoreCm)}
                  </span>
                </TableCell>
                {detailMode &&
                  roundNumbers.map((n) => {
                    const cell = scoreByRound(entry, n);
                    const empty = cell == null || cell.scoreCm == null;
                    const discarded = Boolean(cell?.isDiscarded);
                    const provisional = Boolean(cell?.isProvisional);
                    return (
                      <TableCell key={n} className="px-1 text-center">
                        <span
                          className={cn(
                            'inline-flex min-w-[2.25rem] items-center justify-center rounded px-1 py-0.5 font-mono text-xs tabular-nums sm:text-sm',
                            empty && 'bg-muted/40 text-muted-foreground/50',
                            !empty &&
                              discarded &&
                              'text-red-500 line-through decoration-2 decoration-red-500',
                            !empty &&
                              provisional &&
                              !discarded &&
                              'text-muted-foreground/70',
                            !empty &&
                              cell?.isBullseye &&
                              !discarded &&
                              'font-semibold text-[hsl(var(--score-bullseye))]',
                            !empty && !discarded && !provisional && !cell?.isBullseye && 'text-foreground',
                          )}
                          title={
                            discarded
                              ? 'Discarded (not counted in total)'
                              : provisional
                                ? 'Provisional (not yet scored)'
                                : undefined
                          }
                        >
                          {empty ? '·' : formatScoreCm(cell.scoreCm)}
                        </span>
                      </TableCell>
                    );
                  })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
