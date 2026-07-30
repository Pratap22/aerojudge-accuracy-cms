import { describe, expect, it } from 'vitest';
import { DEFAULT_FAI_2022_RULES } from '@npha/shared';
import { computeFlightScore } from '../individual/flight-score';
import {
  applyDiscardRules,
  calculateIndividualRankings,
} from '../individual/ranking';
import {
  calculateTeamRoundScore,
  validateTeamComposition,
} from '../team/team-scoring';
import { resolveCompetitionRules } from '../rules/profiles';

describe('computeFlightScore', () => {
  const rules = DEFAULT_FAI_2022_RULES;

  it('scores a bullseye as 0 cm', () => {
    const result = computeFlightScore(
      { pilotId: 'p1', roundId: 'r1', distanceCm: 0, resultType: 'BULLSEYE' },
      rules,
    );
    expect(result.finalScoreCm).toBe(0);
    expect(result.isBullseye).toBe(true);
    expect(result.isCountable).toBe(true);
  });

  it('scores measured distance', () => {
    const result = computeFlightScore(
      { pilotId: 'p1', roundId: 'r1', distanceCm: 42, resultType: 'MEASURED' },
      rules,
    );
    expect(result.finalScoreCm).toBe(42);
    expect(result.isBullseye).toBe(false);
  });

  it('applies DNF as maximum', () => {
    const result = computeFlightScore(
      { pilotId: 'p1', roundId: 'r1', distanceCm: null, resultType: 'DNF' },
      rules,
    );
    expect(result.finalScoreCm).toBe(1000);
  });

  it('applies penalty and caps at maximum', () => {
    const result = computeFlightScore(
      {
        pilotId: 'p1',
        roundId: 'r1',
        distanceCm: 980,
        resultType: 'MEASURED',
        penaltyCm: 50,
      },
      rules,
    );
    expect(result.finalScoreCm).toBe(1000);
  });

  it('marks reflight as not countable', () => {
    const result = computeFlightScore(
      { pilotId: 'p1', roundId: 'r1', distanceCm: 10, resultType: 'REFLIGHT' },
      rules,
    );
    expect(result.isCountable).toBe(false);
  });
});

describe('applyDiscardRules', () => {
  it('does not discard before threshold', () => {
    const scores = [
      {
        pilotId: 'p1',
        roundId: 'r1',
        roundNumber: 1,
        finalScoreCm: 10,
        resultType: 'MEASURED' as const,
        isBullseye: false,
        isDiscarded: false,
      },
      {
        pilotId: 'p1',
        roundId: 'r2',
        roundNumber: 2,
        finalScoreCm: 500,
        resultType: 'MEASURED' as const,
        isBullseye: false,
        isDiscarded: false,
      },
    ];
    const rules = { ...DEFAULT_FAI_2022_RULES, discardWorstRounds: 1, discardAfterRounds: 5 };
    const { discarded } = applyDiscardRules(scores, rules);
    expect(discarded).toHaveLength(0);
  });

  it('discards worst round after threshold', () => {
    const scores = Array.from({ length: 5 }, (_, i) => ({
      pilotId: 'p1',
      roundId: `r${i + 1}`,
      roundNumber: i + 1,
      finalScoreCm: i === 2 ? 900 : 10,
      resultType: 'MEASURED' as const,
      isBullseye: false,
      isDiscarded: false,
    }));
    const rules = { ...DEFAULT_FAI_2022_RULES, discardWorstRounds: 1, discardAfterRounds: 5 };
    const { kept, discarded, discardedTotal } = applyDiscardRules(scores, rules);
    expect(discarded).toHaveLength(1);
    expect(discarded[0].finalScoreCm).toBe(900);
    expect(kept).toHaveLength(4);
    expect(discardedTotal).toBe(900);
  });
});

describe('calculateIndividualRankings', () => {
  it('ranks lower total score first', () => {
    const rules = resolveCompetitionRules('FAI_2022');
    const rankings = calculateIndividualRankings(
      [
        {
          pilotId: 'p1',
          pilotNumber: 1,
          roundScores: [
            {
              pilotId: 'p1',
              roundId: 'r1',
              roundNumber: 1,
              finalScoreCm: 10,
              resultType: 'MEASURED',
              isBullseye: false,
              isDiscarded: false,
            },
          ],
        },
        {
          pilotId: 'p2',
          pilotNumber: 2,
          roundScores: [
            {
              pilotId: 'p2',
              roundId: 'r1',
              roundNumber: 1,
              finalScoreCm: 5,
              resultType: 'MEASURED',
              isBullseye: false,
              isDiscarded: false,
            },
          ],
        },
      ],
      rules,
    );
    expect(rankings[0].pilotId).toBe('p2');
    expect(rankings[0].rank).toBe(1);
    expect(rankings[1].rank).toBe(2);
  });
});

describe('team scoring', () => {
  const rules = DEFAULT_FAI_2022_RULES;

  it('sums best N pilot scores', () => {
    const result = calculateTeamRoundScore(
      {
        teamId: 't1',
        type: 'NATIONAL',
        members: [
          { pilotId: 'p1', role: 'PILOT', order: 1 },
          { pilotId: 'p2', role: 'PILOT', order: 2 },
          { pilotId: 'p3', role: 'PILOT', order: 3 },
          { pilotId: 'p4', role: 'RESERVE', order: 4 },
        ],
        scoringPilots: 3,
      },
      'r1',
      [
        { pilotId: 'p1', scoreCm: 10, resultType: 'MEASURED', isCountable: true },
        { pilotId: 'p2', scoreCm: 20, resultType: 'MEASURED', isCountable: true },
        { pilotId: 'p3', scoreCm: 100, resultType: 'MEASURED', isCountable: true },
        { pilotId: 'p4', scoreCm: 5, resultType: 'MEASURED', isCountable: true },
      ],
      rules,
    );
    expect(result.totalScoreCm).toBe(130);
    expect(result.countedPilots).toHaveLength(3);
    expect(result.audit.length).toBeGreaterThan(0);
  });

  it('validates team composition', () => {
    const result = validateTeamComposition(
      {
        teamId: 't1',
        type: 'NATIONAL',
        members: [
          { pilotId: 'p1', role: 'PILOT', order: 1 },
          { pilotId: 'p2', role: 'PILOT', order: 2 },
        ],
        scoringPilots: 3,
      },
      rules,
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
