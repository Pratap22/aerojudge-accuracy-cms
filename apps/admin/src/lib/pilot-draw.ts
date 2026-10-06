import { STARTED_ROUND_STATUSES, type RoundStatus } from '@aero-judge/shared';

const started = new Set<RoundStatus>(STARTED_ROUND_STATUSES);

/** True once any round has started, so bibs are no longer drawn and pilots cannot be added. */
export function competitionDrawClosed(rounds: { status: RoundStatus }[]): boolean {
  return rounds.some((round) => started.has(round.status));
}

/** Full-screen draw with no admin navigation, used when the draw opens in a new tab. */
export function isDrawPresentation(pathname: string): boolean {
  return pathname.endsWith('/pilots/draw/present');
}
