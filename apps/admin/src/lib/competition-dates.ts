/** Calendar day (`YYYY-MM-DD`) in UTC, matching date-only values stored at UTC midnight. */
export function toCompetitionDateInput(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/** Readable calendar day for a competition start or end date. */
export function formatCompetitionDate(value: string | Date): string {
  const day = toCompetitionDateInput(value);
  if (!day) return '—';
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Readable start–end range for a competition. */
export function formatCompetitionDateRange(start: string | Date, end: string | Date): string {
  return `${formatCompetitionDate(start)} – ${formatCompetitionDate(end)}`;
}
