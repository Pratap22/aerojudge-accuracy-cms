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
  /** Optional round scores for expandable detail */
  roundScores?: Array<{ round: number; scoreCm: number | null; isBullseye?: boolean }>;
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

export function LeaderboardTable({
  entries,
  title,
  nameColumn = 'Pilot',
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
            <TableHead>{nameColumn}</TableHead>
            {showRounds && <TableHead className="hidden text-right sm:table-cell">Rounds</TableHead>}
            {showBullseyes && (
              <TableHead className="hidden text-right md:table-cell">Bullseyes</TableHead>
            )}
            <TableHead className="text-right">Total (cm)</TableHead>
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
                {showRounds && (
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
                      entry.totalScoreCm === 0 && 'text-[hsl(var(--score-bullseye))]',
                    )}
                  >
                    {formatScoreCm(entry.totalScoreCm)}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
