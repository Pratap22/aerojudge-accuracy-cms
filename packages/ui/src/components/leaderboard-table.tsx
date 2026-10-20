import * as React from 'react';
import { formatScoreCm } from '@aero-judge/utils';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { cn } from '../lib/utils';
import { PilotChip } from './pilot-chip';
import { RankBadge } from './rank-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

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
  /** ISO 3166-1 alpha-3 country code shown in the UI */
  countryCode?: string;
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
  /** Pilot headshot for ranking tables / venue displays */
  photoUrl?: string | null;
  /** Highlight row e.g. current pilot */
  isHighlighted?: boolean;
  /** Hide pilot-number badge (teams / countries) */
  hideNumber?: boolean;
  /** Opens the pilot profile. Full browser path, including the app base. */
  profileHref?: string;
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

function scoreByRound(entry: LeaderboardEntry, round: number): LeaderboardRoundScore | undefined {
  return entry.roundScores?.find((rs) => rs.round === round);
}

/** A live round filled at the maximum because the pilot has not landed yet. */
function awaitingLanding(entry: LeaderboardEntry): boolean {
  return (entry.roundScores ?? []).some((rs) => rs.isProvisional);
}

/**
 * Score column for the board. Ranking still uses `totalScoreCm`, which includes
 * the live maximum for a pilot who has not landed. That fill is omitted here
 * so the number matches the rounds already flown.
 */
type SortKey = 'rank' | 'number';
type SortDir = 'asc' | 'desc';

function SortLabel({
  label,
  active,
  dir,
  onClick,
  ariaLabel,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  ariaLabel?: string;
}) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? `Sort by ${label}`}
      className="inline-flex items-center gap-1 text-inherit hover:text-foreground"
    >
      {label}
      <Icon className="h-3.5 w-3.5 opacity-70" aria-hidden />
    </button>
  );
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

function scoreColumnCm(entry: LeaderboardEntry): number {
  const rounds = entry.roundScores ?? [];
  if (!rounds.some((rs) => rs.isProvisional)) return entry.totalScoreCm;
  return rounds.reduce((sum, rs) => {
    if (rs.isProvisional || rs.isDiscarded || rs.scoreCm == null) return sum;
    return sum + rs.scoreCm;
  }, 0);
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

  const [sortKey, setSortKey] = React.useState<SortKey>('rank');
  const [sortDir, setSortDir] = React.useState<SortDir>('asc');
  const sortByNumber = entries.some((entry) => !entry.hideNumber);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  };

  const sortedEntries = React.useMemo(() => {
    const factor = sortDir === 'asc' ? 1 : -1;
    return [...entries].sort((a, b) => {
      if (sortKey === 'number') {
        if (sortByNumber) return (a.pilotNumber - b.pilotNumber) * factor;
        const aName = (a.displayName ?? `${a.firstName} ${a.lastName}`).trim();
        const bName = (b.displayName ?? `${b.firstName} ${b.lastName}`).trim();
        return aName.localeCompare(bName) * factor;
      }
      return (a.rank - b.rank) * factor;
    });
  }, [entries, sortByNumber, sortDir, sortKey]);

  const detailMode = showRoundScores && roundNumbers.length > 0;
  // When rounds are expanded, "9/9" is redundant unless callers keep it on.
  const showRoundsCount = showRounds && !detailMode;
  const phone = usePhoneLayout();
  const dense = compact || (detailMode && phone);
  // Phone widths: rank + pilot + total stay put; rounds use whatever is left.
  const frozen = 'max-md:sticky max-md:z-20 max-md:!px-1 max-md:py-2';
  const frozenBg = 'max-md:bg-card';
  const rankCol = detailMode
    ? 'w-[var(--lb-rank)] min-w-[var(--lb-rank)] max-w-[var(--lb-rank)] md:w-[4.75rem] md:min-w-[4.75rem] md:max-w-none'
    : cn('w-[4.75rem] min-w-[4.75rem]', compact && 'w-12 min-w-12');
  const pilotCol = detailMode
    ? 'max-md:left-[var(--lb-rank)] max-md:w-[var(--lb-pilot)] max-md:min-w-[var(--lb-pilot)] max-md:max-w-[var(--lb-pilot)] max-md:border-r max-md:border-border'
    : '';
  const scoreCol = detailMode
    ? 'max-md:left-[calc(var(--lb-rank)+var(--lb-pilot))] max-md:w-[var(--lb-score)] max-md:min-w-[var(--lb-score)] max-md:max-w-[var(--lb-score)] max-md:border-r max-md:border-border'
    : '';

  return (
    <div
      className={cn(
        'min-w-full w-max',
        detailMode && '[--lb-pilot:8rem] [--lb-rank:3.5rem] [--lb-score:3rem]',
        className,
      )}
      {...props}
    >
      {title && (
        <h3 className="mb-4 text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      )}
      <Table
        containerClassName="overflow-visible"
        className="w-max min-w-full border-separate border-spacing-0"
      >
        <TableHeader>
          <TableRow>
            <TableHead
              className={cn(rankCol, detailMode && frozen, detailMode && frozenBg, detailMode && 'max-md:left-0')}
              aria-sort={sortKey === 'rank' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              <SortLabel
                label="Rank"
                active={sortKey === 'rank'}
                dir={sortDir}
                onClick={() => toggleSort('rank')}
              />
            </TableHead>
            <TableHead
              className={cn(detailMode && frozen, detailMode && frozenBg, pilotCol)}
              aria-sort={
                sortKey === 'number' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
              }
            >
              <SortLabel
                label={nameColumn}
                active={sortKey === 'number'}
                dir={sortDir}
                onClick={() => toggleSort('number')}
                ariaLabel={sortByNumber ? `Sort by pilot number` : `Sort by ${nameColumn}`}
              />
            </TableHead>
            {showRoundsCount && (
              <TableHead className="hidden text-right sm:table-cell">Rounds</TableHead>
            )}
            {showBullseyes && (
              <TableHead className="hidden text-right md:table-cell">Bullseyes</TableHead>
            )}
            <TableHead className={cn('text-right', detailMode && frozen, detailMode && frozenBg, scoreCol)}>
              {detailMode ? 'Score' : 'Total (cm)'}
            </TableHead>
            {detailMode &&
              roundNumbers.map((n) => (
                <TableHead key={n} className="!px-0 text-center tabular-nums max-md:w-8 md:min-w-[2.75rem] md:!px-1 md:w-auto">
                  {n}.
                </TableHead>
              ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedEntries.map((entry) => {
            const label =
              entry.displayName ??
              `${entry.firstName}${entry.lastName ? ` ${entry.lastName}` : ''}`.trim();
            const flagEmoji = toFlagEmoji(entry.countryCode2);
            const pendingLanding = awaitingLanding(entry);
            const shownScoreCm = scoreColumnCm(entry);
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
                <TableCell
                  className={cn(detailMode && frozen, detailMode && frozenBg, detailMode && 'max-md:left-0', rankCol)}
                >
                  <RankBadge rank={entry.rank} size={dense ? 'sm' : 'default'} />
                </TableCell>
                <TableCell className={cn(detailMode && frozen, detailMode && frozenBg, pilotCol)}>
                  <div
                    className={
                      detailMode
                        ? 'max-md:w-[calc(var(--lb-pilot)-0.5rem)] max-md:max-w-[calc(var(--lb-pilot)-0.5rem)] max-md:overflow-hidden'
                        : undefined
                    }
                  >
                  {entry.hideNumber ? (
                    <div className="flex min-w-0 items-center gap-2 font-medium">
                      {flagEmoji && (
                        <span className="text-base leading-none" aria-hidden>
                          {flagEmoji}
                        </span>
                      )}
                      <span>{label}</span>
                    </div>
                  ) : entry.profileHref ? (
                    <a
                      href={entry.profileHref}
                      className="flex w-full min-w-0 max-w-full rounded-lg outline-offset-2 hover:bg-muted/70"
                    >
                      <PilotChip
                        pilotNumber={entry.pilotNumber}
                        firstName={entry.firstName}
                        lastName={entry.lastName}
                        countryCode2={entry.countryCode2}
                        countryCode={entry.countryCode}
                        flagUrl={entry.flagUrl}
                        photoUrl={entry.photoUrl}
                        size={dense ? 'sm' : 'default'}
                        className={detailMode ? 'max-md:w-full max-md:!gap-x-1.5 max-md:[&_[data-pilot-photo]]:h-8 max-md:[&_[data-pilot-photo]]:w-8' : undefined}
                      />
                    </a>
                  ) : (
                    <PilotChip
                      pilotNumber={entry.pilotNumber}
                      firstName={entry.firstName}
                      lastName={entry.lastName}
                      countryCode2={entry.countryCode2}
                      countryCode={entry.countryCode}
                      flagUrl={entry.flagUrl}
                      photoUrl={entry.photoUrl}
                      size={dense ? 'sm' : 'default'}
                      className={detailMode ? 'max-md:w-full max-md:!gap-x-1.5 max-md:[&_[data-pilot-photo]]:h-8 max-md:[&_[data-pilot-photo]]:w-8' : undefined}
                    />
                  )}
                  </div>
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
                <TableCell className={cn('text-right', detailMode && frozen, detailMode && frozenBg, scoreCol)}>
                  <span
                    className={cn(
                      'font-mono font-semibold tabular-nums',
                      detailMode &&
                        'inline-flex min-w-[2.25rem] items-center justify-center rounded-md px-1.5 py-0.5 md:min-w-[2.75rem] md:px-2',
                      pendingLanding
                        ? 'bg-orange-500 text-white'
                        : detailMode && 'bg-foreground text-background',
                      shownScoreCm === 0 &&
                        !detailMode &&
                        !pendingLanding &&
                        'text-[hsl(var(--score-bullseye))]',
                    )}
                    title={pendingLanding ? 'Yet to land — maximum not shown' : undefined}
                  >
                    {formatScoreCm(shownScoreCm)}
                  </span>
                </TableCell>
                {detailMode &&
                  roundNumbers.map((n) => {
                    const cell = scoreByRound(entry, n);
                    const empty = cell == null || cell.scoreCm == null;
                    const discarded = Boolean(cell?.isDiscarded);
                    const provisional = Boolean(cell?.isProvisional);
                    return (
                      <TableCell key={n} className="!px-0 text-center md:!px-1">
                        <span
                          className={cn(
                            'inline-flex min-w-[2rem] items-center justify-center rounded px-0 py-0.5 font-mono text-xs tabular-nums sm:min-w-[2.25rem] sm:px-1 sm:text-sm',
                            empty && 'bg-muted/40 text-muted-foreground/50',
                            !empty &&
                              discarded &&
                              'text-red-500 line-through decoration-2 decoration-red-500',
                            !empty && provisional && !discarded && 'text-muted-foreground/70',
                            !empty &&
                              cell?.isBullseye &&
                              !discarded &&
                              'font-semibold text-[hsl(var(--score-bullseye))]',
                            !empty &&
                              !discarded &&
                              !provisional &&
                              !cell?.isBullseye &&
                              'text-foreground',
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
