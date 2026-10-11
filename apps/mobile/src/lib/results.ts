import { formatPilotName, formatScoreCm } from '@aero-judge/utils';
import type { PublicCompetitionSummary, PublicRankingRow } from './types';

export const TOP_LAYOUT = 'top10';
export const TOP_LAYOUT_LIMIT = 10;

export function firstParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

export function formatEventDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatEventRange(start: string, end: string): string {
  const startLabel = formatEventDate(start);
  const endLabel = formatEventDate(end);
  if (startLabel === endLabel) return startLabel;
  return `${startLabel} – ${endLabel}`;
}

export function competitionStatusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

export function competitionMatchesQuery(
  competition: Pick<PublicCompetitionSummary, 'name' | 'venue' | 'country' | 'code' | 'organizer'>,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    competition.name,
    competition.venue,
    competition.country,
    competition.code,
    competition.organizer,
  ]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

export function rankingEntryName(row: PublicRankingRow): string {
  if (row.pilot) {
    const name = formatPilotName(row.pilot.firstName, row.pilot.lastName);
    if (name) return name;
  }
  const teamName = row.team?.name.trim();
  if (teamName) return teamName;
  const countryName = row.country?.name.trim();
  if (countryName) return countryName;
  return 'Unnamed';
}

export function rankingSubtitle(row: PublicRankingRow): string {
  const parts: string[] = [];
  if (row.pilot) {
    parts.push(`#${row.pilot.pilotNumber}`);
    const code = row.pilot.country?.code?.trim();
    if (code) parts.push(code);
  } else if (row.team?.country?.code?.trim()) {
    parts.push(row.team.country.code.trim());
  } else if (row.country?.code?.trim()) {
    parts.push(row.country.code.trim());
  }

  if (row.roundsFlown > 0) {
    parts.push(`${row.roundsFlown} ${row.roundsFlown === 1 ? 'round' : 'rounds'}`);
  }
  if (row.bullseyes > 0) {
    parts.push(`${row.bullseyes} ${row.bullseyes === 1 ? 'bullseye' : 'bullseyes'}`);
  }
  return parts.join(' · ');
}

/** Padded centimetre score, shared with the website via `@aero-judge/utils`. */
export function formatRankingScore(scoreCm: number): string {
  return formatScoreCm(scoreCm);
}

/**
 * `layout=top10` matches the venue display board and shows the first ten rows.
 * Any other layout shows the full category.
 */
export function visibleRankings<T>(rows: readonly T[], layout: string | null): readonly T[] {
  if (layout === TOP_LAYOUT) return rows.slice(0, TOP_LAYOUT_LIMIT);
  return rows;
}

export function formatFetchedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Describe how fresh the standings are.
 * "Live" is only for an open competition with a connected public socket and a successful load.
 */
export function resultsStatusLine(input: {
  official: boolean;
  completed: boolean;
  stale: boolean;
  live: boolean;
  fetchedAtLabel: string | null;
}): string {
  const base =
    input.completed && input.official
      ? 'Official final standings'
      : input.official
        ? 'Official results'
        : 'Provisional results';

  if (input.stale) {
    return input.fetchedAtLabel
      ? `${base}. Couldn't refresh. Showing results last loaded ${input.fetchedAtLabel}.`
      : `${base}. Couldn't refresh.`;
  }

  if (input.live && !input.completed) {
    return input.fetchedAtLabel
      ? `${base} · Live · Updated ${input.fetchedAtLabel}`
      : `${base} · Live`;
  }

  return input.fetchedAtLabel ? `${base} · Updated ${input.fetchedAtLabel}` : base;
}
