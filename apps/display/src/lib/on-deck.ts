import { onDeckSlots } from '@aero-judge/utils';
import type { PublicLaunchFlight } from './api';
import type { PublicRankingRow } from './types';

function hasRecordedRoundScore(row: PublicRankingRow, displayRound: number): boolean {
  return (row.roundScores ?? []).some(
    (score) =>
      score.round === displayRound &&
      !score.isProvisional &&
      score.scoreCm != null &&
      score.resultType !== 'REFLIGHT',
  );
}

function rowForPilot(
  pilotId: string,
  rankings: PublicRankingRow[],
  flight?: PublicLaunchFlight,
): PublicRankingRow | null {
  const ranked = rankings.find((row) => row.pilotId === pilotId || row.id === pilotId);
  if (ranked?.pilot) return ranked;
  if (!flight) return ranked ?? null;
  return {
    id: pilotId,
    pilotId,
    rank: ranked?.rank ?? 0,
    totalScoreCm: ranked?.totalScoreCm ?? 0,
    roundsFlown: ranked?.roundsFlown ?? 0,
    bullseyes: ranked?.bullseyes ?? 0,
    pilot: {
      pilotNumber: flight.pilotNumber,
      firstName: flight.firstName,
      lastName: flight.lastName,
      photoUrl: flight.photoUrl,
      country: flight.country,
    },
  };
}

/**
 * On-deck cards for the live round.
 * Flight order is the queue. Pilots with a score for this round are left out,
 * including the pilot who just scored — the next pilot still to fly takes "now flying".
 */
export function buildOnDeck(input: {
  rankings: PublicRankingRow[];
  flights: PublicLaunchFlight[];
  anchorPilotId: string | null;
  activeDisplayRound: number | null;
  justScoredPilotId: string | null;
}): { nowFlying: PublicRankingRow | null; queue: PublicRankingRow[] } {
  const { rankings, flights, anchorPilotId, activeDisplayRound, justScoredPilotId } = input;

  const finished = (pilotId: string, flightStillToFly: boolean | null): boolean => {
    if (justScoredPilotId != null && pilotId === justScoredPilotId) return true;
    if (activeDisplayRound != null) {
      const row = rankings.find((entry) => entry.pilotId === pilotId || entry.id === pilotId);
      if (row && hasRecordedRoundScore(row, activeDisplayRound)) return true;
    }
    return flightStillToFly === false;
  };

  const ordered =
    flights.length > 0
      ? [...flights]
          .sort((a, b) => a.flightOrder - b.flightOrder)
          .map((flight) => ({
            pilotId: flight.pilotId,
            stillToFly: !finished(flight.pilotId, flight.stillToFly),
            flight,
          }))
      : rankings
          .filter((row) => row.pilot)
          .map((row) => ({
            pilotId: row.pilotId ?? row.id,
            stillToFly: !finished(row.pilotId ?? row.id, null),
            flight: undefined as PublicLaunchFlight | undefined,
          }));

  const slots = onDeckSlots(ordered, anchorPilotId);
  const toRow = (entry: (typeof ordered)[number] | undefined) =>
    entry ? rowForPilot(entry.pilotId, rankings, entry.flight) : null;

  return {
    nowFlying: toRow(slots.nowFlying ?? undefined),
    queue: slots.queue
      .map((entry) => toRow(entry))
      .filter((row): row is PublicRankingRow => row != null),
  };
}
