/**
 * Individual flight score computation – FAI Section 7C
 *
 * Score = measured distance from target centre in centimetres.
 * Bullseye = 0 cm (dead centre).
 * DNF / ABS / DNS / out-of-range = maximum score (typically 1000 cm).
 * Penalties are added to the measured distance, capped at maximum.
 */

import type {
  ComputedScore,
  RuleConfig,
  ScoreInput,
  ScoreResultType,
  ScoringAuditEntry,
} from '@npha/shared';

function audit(step: string, detail: string, data?: Record<string, unknown>): ScoringAuditEntry {
  return { timestamp: new Date().toISOString(), step, detail, data };
}

export function computeFlightScore(input: ScoreInput, rules: RuleConfig): ComputedScore {
  const notes: string[] = [];
  const audits: ScoringAuditEntry[] = [];
  const penaltyCm = input.penaltyCm ?? 0;

  audits.push(
    audit('input', 'Received score input', {
      pilotId: input.pilotId,
      roundId: input.roundId,
      distanceCm: input.distanceCm,
      resultType: input.resultType,
      penaltyCm,
    }),
  );

  // Reflights are excluded from ranking until a valid replacement score exists
  if (input.resultType === 'REFLIGHT' || input.isReflight) {
    notes.push('Marked for reflight – not countable until replacement scored');
    return {
      pilotId: input.pilotId,
      roundId: input.roundId,
      distanceCm: input.distanceCm,
      resultType: 'REFLIGHT',
      penaltyCm,
      finalScoreCm: rules.maximumScoreCm,
      isBullseye: false,
      isCountable: false,
      notes,
    };
  }

  // DSQ – disqualification: maximum score, countable for ranking as worst
  if (input.resultType === 'DSQ') {
    notes.push('Disqualified – maximum score applied');
    return {
      pilotId: input.pilotId,
      roundId: input.roundId,
      distanceCm: null,
      resultType: 'DSQ',
      penaltyCm,
      finalScoreCm: rules.maximumScoreCm,
      isBullseye: false,
      isCountable: true,
      notes,
    };
  }

  // Non-measured result types that take maximum
  if (rules.maxScoreResultTypes.includes(input.resultType)) {
    const final = Math.min(rules.maximumScoreCm + penaltyCm, rules.maximumScoreCm);
    notes.push(`${input.resultType} – maximum score ${rules.maximumScoreCm} cm applied`);
    return {
      pilotId: input.pilotId,
      roundId: input.roundId,
      distanceCm: null,
      resultType: input.resultType,
      penaltyCm,
      finalScoreCm: final,
      isBullseye: false,
      isCountable: true,
      notes,
    };
  }

  // Explicit bullseye
  if (input.resultType === 'BULLSEYE') {
    const final = Math.min(rules.bullseyeScoreCm + penaltyCm, rules.maximumScoreCm);
    notes.push(`Bullseye – ${rules.bullseyeScoreCm} cm` + (penaltyCm ? ` + penalty ${penaltyCm}` : ''));
    return {
      pilotId: input.pilotId,
      roundId: input.roundId,
      distanceCm: rules.bullseyeScoreCm,
      resultType: 'BULLSEYE',
      penaltyCm,
      finalScoreCm: final,
      isBullseye: final === rules.bullseyeScoreCm && penaltyCm === 0,
      isCountable: true,
      notes,
    };
  }

  // Measured distance
  if (input.distanceCm === null || input.distanceCm === undefined) {
    notes.push('No distance provided – treating as MAXIMUM');
    return {
      pilotId: input.pilotId,
      roundId: input.roundId,
      distanceCm: null,
      resultType: 'MAXIMUM',
      penaltyCm,
      finalScoreCm: rules.maximumScoreCm,
      isBullseye: false,
      isCountable: true,
      notes,
    };
  }

  let distance = Math.max(0, input.distanceCm);

  // Cap at maximum (outside measuring area)
  if (distance > rules.maximumScoreCm) {
    notes.push(
      `Distance ${distance} cm exceeds maximum ${rules.maximumScoreCm} cm – capped`,
    );
    distance = rules.maximumScoreCm;
  }

  const isBullseye = distance === rules.bullseyeScoreCm && penaltyCm === 0;
  let resultType: ScoreResultType = isBullseye ? 'BULLSEYE' : 'MEASURED';
  if (distance >= rules.maximumScoreCm && !isBullseye) {
    resultType = 'MAXIMUM';
  }

  const finalScoreCm = Math.min(distance + penaltyCm, rules.maximumScoreCm);
  if (penaltyCm > 0) {
    notes.push(`Penalty of ${penaltyCm} cm applied`);
  }
  if (isBullseye) {
    notes.push('Bullseye scored');
  }

  return {
    pilotId: input.pilotId,
    roundId: input.roundId,
    distanceCm: distance,
    resultType,
    penaltyCm,
    finalScoreCm,
    isBullseye,
    isCountable: true,
    notes,
  };
}

export function isValidMeasuredDistance(cm: number, rules: RuleConfig): boolean {
  return Number.isFinite(cm) && cm >= 0 && cm <= rules.maximumScoreCm * 2;
}
