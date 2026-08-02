/**
 * Estimated organizer time saved vs traditional paper / spreadsheet ops.
 *
 * Conservative assumptions:
 * - 3 minutes per pilot-round (enter, verify, update sheets)
 * - 25 minutes per round (rankings, notice board, display sync)
 */
export function estimateMinutesSaved(pilots: number, rounds: number): number {
  const p = Math.max(0, pilots);
  const r = Math.max(0, rounds);
  return p * r * 3 + r * 25;
}

export function estimateHoursSaved(pilots: number, rounds: number): number {
  return Math.round((estimateMinutesSaved(pilots, rounds) / 60) * 10) / 10;
}

export function formatHoursSaved(hours: number): string {
  if (hours <= 0) return '0 hrs';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (Number.isInteger(hours)) return `${hours} hrs`;
  return `${hours.toFixed(1)} hrs`;
}
