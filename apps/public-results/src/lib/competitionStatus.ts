/** Competition lifecycle helpers for public UI. */

const COMPLETED_LIKE = new Set(['COMPLETED', 'CANCELLED']);

/** Scoring / live results have started (practice day or official). */
const SCORING_STARTED = new Set(['PRACTICE', 'OFFICIAL', 'PAUSED']);

export function isCompetitionCompleted(status: string | undefined | null): boolean {
  return Boolean(status && COMPLETED_LIKE.has(status));
}

/** True once practice or official flying has begun. */
export function hasCompetitionStarted(status: string | undefined | null): boolean {
  return Boolean(status && SCORING_STARTED.has(status));
}

const CLOSED_PUBLIC_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'ARCHIVED', 'DRAFT']);

/**
 * Registration is the phase before any round starts.
 * Completed and cancelled competitions stay out of that phase.
 */
export function isRegistrationPhase(
  competition:
    | {
        status?: string | null;
        roundsStarted?: boolean;
      }
    | null
    | undefined,
): boolean {
  if (!competition) return false;
  if (competition.roundsStarted) return false;
  if (competition.status && CLOSED_PUBLIC_STATUSES.has(competition.status)) return false;
  return true;
}

/**
 * Public register screen. Open until a round starts, unless the competition
 * turns self-registration off.
 */
export function showPublicRegistration(
  competition:
    | {
        status?: string | null;
        roundsStarted?: boolean;
        registrationOpen?: boolean;
        settings?: { publicRegistrationEnabled?: boolean } | null;
      }
    | null
    | undefined,
): boolean {
  if (!competition) return false;
  if (typeof competition.registrationOpen === 'boolean') return competition.registrationOpen;
  if (competition.settings?.publicRegistrationEnabled === false) return false;
  return isRegistrationPhase(competition);
}

/**
 * Register navigation stays up through the registration phase when pilots can
 * sign up here, or when the page shows external registration links and QR codes.
 */
export function showRegistrationPage(
  competition:
    | {
        status?: string | null;
        roundsStarted?: boolean;
        registrationOpen?: boolean;
        settings?: { publicRegistrationEnabled?: boolean } | null;
      }
    | null
    | undefined,
): boolean {
  if (!isRegistrationPhase(competition)) return false;
  if (showPublicRegistration(competition)) return true;
  return competition?.settings?.publicRegistrationEnabled === false;
}
