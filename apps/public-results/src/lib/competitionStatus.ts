/** Competition lifecycle helpers for public UI. */

const COMPLETED_LIKE = new Set(['COMPLETED', 'CANCELLED']);

/** Scoring / live results have started (practice day or official). */
const SCORING_STARTED = new Set(['PRACTICE', 'OFFICIAL', 'PAUSED']);

/** Self-registration is open. */
const REGISTRATION_OPEN = new Set(['REGISTRATION', 'PRACTICE']);

export function isCompetitionCompleted(status: string | undefined | null): boolean {
  return Boolean(status && COMPLETED_LIKE.has(status));
}

/** True once practice or official flying has begun. */
export function hasCompetitionStarted(status: string | undefined | null): boolean {
  return Boolean(status && SCORING_STARTED.has(status));
}

export function isRegistrationOpen(status: string | undefined | null): boolean {
  return Boolean(status && REGISTRATION_OPEN.has(status));
}

/** Pre-event: published but no scoring yet. */
export function isPreEvent(status: string | undefined | null): boolean {
  return status === 'REGISTRATION';
}
