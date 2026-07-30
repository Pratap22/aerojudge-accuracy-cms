import * as React from 'react';

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

export interface LeaderboardEntry {
  rank: number;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  countryCode2?: string;
  flagUrl?: string;
  /** Total score in cm (lower is better) */
  totalScoreCm: number;
  roundsFlown?: number;
  bullseyes?: number;
  /** Optional round scores for expandable detail */
  roundScores?: Array<{ round: number; scoreCm: number | null; isBullseye?: boolean }>;
  /** Highlight row e.g. current pilot */
  isHighlighted?: boolean;
}

export interface LeaderboardTableProps extends React.HTMLAttributes<HTMLDivElement> {
  entries: LeaderboardEntry[];
  title?: string;
  showBullseyes?: boolean;
  showRounds?: boolean;
  compact?: boolean;
  /** Highlight top N ranks with podium styling */
  highlightPodium?: boolean;
}

function formatScore(scoreCm: number): string {
  if (scoreCm === 0) return '0';
  if (Number.isInteger(scoreCm)) return scoreCm.toString();
  return scoreCm.toFixed(1);
}

export function LeaderboardTable({
  entries,
  title,
  showBullseyes = true,
  showRounds = true,
  compact = false,
  highlightPodium = true,
  className,
  ...props
}: LeaderboardTableProps) {
  return (
    <div className={cn('w-full', className)} {...props}>
      {title && (
        <h3 className="mb-4 text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={cn('w-16', compact && 'w-12')}>Rank</TableHead>
            <TableHead>Pilot</TableHead>
            {showRounds && <TableHead className="hidden text-right sm:table-cell">Rounds</TableHead>}
            {showBullseyes && (
              <TableHead className="hidden text-right md:table-cell">Bullseyes</TableHead>
            )}
            <TableHead className="text-right">Total (cm)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow
              key={`${entry.rank}-${entry.pilotNumber}`}
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
                <PilotChip
                  pilotNumber={entry.pilotNumber}
                  firstName={entry.firstName}
                  lastName={entry.lastName}
                  countryCode2={entry.countryCode2}
                  flagUrl={entry.flagUrl}
                  size={compact ? 'sm' : 'default'}
                />
              </TableCell>
              {showRounds && (
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {entry.roundsFlown ?? '—'}
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
                    entry.totalScoreCm === 0 && 'text-[hsl(var(--score-bullseye))]',
                  )}
                >
                  {formatScore(entry.totalScoreCm)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
