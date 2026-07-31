/** Competition lifecycle statuses treated as finished for public UI. */
const COMPLETED_LIKE = new Set(['COMPLETED', 'ARCHIVED', 'CANCELLED']);

export function isCompetitionCompleted(status: string | undefined | null): boolean {
  return Boolean(status && COMPLETED_LIKE.has(status));
}
