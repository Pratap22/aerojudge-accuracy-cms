import { describe, expect, it } from 'vitest';
import { DEFAULT_FAI_2022_RULES } from '@npha/shared';
import { computeFlightScore } from '../individual/flight-score';
import {
  applyDiscardRules,
  calculateIndividualRankings,
  fillMissingRoundScoresAsDnf,
} from '../individual/ranking';
import {
  calculateTeamRoundScore,
  calculateTeamRankings,
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

describe('calculateIndividualRankings discard vs rounds flown', () => {
  it('counts discarded rounds in roundsFlown but not in total', () => {
    const rules = { ...DEFAULT_FAI_2022_RULES, discardWorstRounds: 1, discardAfterRounds: 5 };
    const roundScores = Array.from({ length: 9 }, (_, i) => ({
      pilotId: 'p1',
      roundId: `r${i + 1}`,
      roundNumber: i + 1,
      finalScoreCm: i === 0 ? 5 : 1,
      resultType: 'MEASURED' as const,
      isBullseye: false,
      isDiscarded: false,
    }));
    const rankings = calculateIndividualRankings(
      [{ pilotId: 'p1', pilotNumber: 1, roundScores }],
      rules,
    );
    expect(rankings[0].roundsFlown).toBe(9);
    expect(rankings[0].discardedScoreCm).toBe(5);
    expect(rankings[0].totalScoreCm).toBe(8);
  });

  it('counts finished-round DNF fills toward roundsFlown, not live provisional fills', () => {
    const rules = { ...DEFAULT_FAI_2022_RULES, discardWorstRounds: 0, discardAfterRounds: 5 };
    const pilots = fillMissingRoundScoresAsDnf(
      [
        {
          pilotId: 'p1',
          pilotNumber: 1,
          roundScores: [
            {
              pilotId: 'p1',
              roundId: 'r1',
              roundNumber: 1,
              finalScoreCm: 3,
              resultType: 'MEASURED',
              isBullseye: false,
              isDiscarded: false,
            },
          ],
        },
      ],
      [
        { id: 'r1', number: 1, isFinal: true },
        { id: 'r2', number: 2, isFinal: true },
        { id: 'r3', number: 3, isFinal: false },
      ],
      rules,
    );
    const rankings = calculateIndividualRankings(pilots, rules);
    // Real r1 + final DNF r2 count; live provisional r3 does not count as flown
    expect(rankings[0].roundsFlown).toBe(2);
    // Totals still include provisional live fills so standings stay conservative
    expect(rankings[0].totalScoreCm).toBe(3 + rules.maximumScoreCm * 2);
  });

  it('team rankings sum all rounds; discard rules apply only per-pilot within each round', () => {
    const rules = { ...DEFAULT_FAI_2022_RULES, discardWorstRounds: 1, discardAfterRounds: 5 };
    const roundScores = Array.from({ length: 9 }, (_, i) => ({
      teamId: 't1',
      roundId: `r${i + 1}`,
      totalScoreCm: i === 0 ? 90 : 10,
      countedPilots: [],
      discardedPilots: [],
      audit: [],
    }));
    const rankings = calculateTeamRankings(
      [
        {
          teamId: 't1',
          type: 'NATIONAL',
          members: [{ pilotId: 'p1', role: 'PILOT', order: 1 }],
          scoringPilots: 1,
        },
      ],
      roundScores,
      rules,
      'TEAM',
    );
    expect(rankings[0].roundsScored).toBe(9);
    // Worst team round is NOT dropped — 90 + 8×10
    expect(rankings[0].totalScoreCm).toBe(170);
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

  it('fills missing round scores as DNF at maximum', () => {
    const rules = resolveCompetitionRules('FAI_2022');
    const pilots = [
      {
        pilotId: 'p1',
        pilotNumber: 1,
        roundScores: [
          {
            pilotId: 'p1',
            roundId: 'r1',
            roundNumber: 1,
            finalScoreCm: 10,
            resultType: 'MEASURED' as const,
            isBullseye: false,
            isDiscarded: false,
          },
        ],
      },
      {
        pilotId: 'p2',
        pilotNumber: 2,
        roundScores: [],
      },
    ];
    const filled = fillMissingRoundScoresAsDnf(
      pilots,
      [
        { id: 'r1', number: 1 },
        { id: 'r2', number: 2 },
      ],
      rules,
    );
    expect(filled[0].roundScores).toHaveLength(2);
    expect(filled[0].roundScores[1]).toMatchObject({
      resultType: 'DNF',
      finalScoreCm: 1000,
      roundId: 'r2',
      isProvisional: true,
    });
    expect(filled[1].roundScores).toHaveLength(2);
    expect(filled[1].roundScores.every((s) => s.resultType === 'DNF' && s.isProvisional)).toBe(
      true,
    );

    const rankings = calculateIndividualRankings(filled, rules);
    expect(rankings[0].pilotId).toBe('p1');
    expect(rankings[0].totalScoreCm).toBe(1010);
    expect(rankings[0].roundsFlown).toBe(1);
    expect(rankings[1].totalScoreCm).toBe(2000);
    expect(rankings[1].roundsFlown).toBe(0);
  });

  it('ranks a scored pilot ahead of unscored pilots using maximum for missing', () => {
    const rules = { ...resolveCompetitionRules('FAI_2022'), maximumScoreCm: 500 };
    const filled = fillMissingRoundScoresAsDnf(
      [
        { pilotId: 'p1', pilotNumber: 1, roundScores: [] },
        {
          pilotId: 'p30',
          pilotNumber: 30,
          roundScores: [
            {
              pilotId: 'p30',
              roundId: 'r1',
              roundNumber: 1,
              finalScoreCm: 5,
              resultType: 'MEASURED',
              isBullseye: false,
              isDiscarded: false,
            },
          ],
        },
        { pilotId: 'p2', pilotNumber: 2, roundScores: [] },
      ],
      [{ id: 'r1', number: 1 }],
      rules,
    );
    const rankings = calculateIndividualRankings(filled, rules);
    expect(rankings[0].pilotId).toBe('p30');
    expect(rankings[0].rank).toBe(1);
    expect(rankings[0].totalScoreCm).toBe(5);
    expect(rankings[1].totalScoreCm).toBe(500);
    expect(rankings[1].roundsFlown).toBe(0);
  });

  it('does not rank a maximum score above a better measured score', () => {
    const rules = resolveCompetitionRules('FAI_2022');
    const rankings = calculateIndividualRankings(
      [
        {
          pilotId: 'p30',
          pilotNumber: 30,
          roundScores: [
            {
              pilotId: 'p30',
              roundId: 'r1',
              roundNumber: 1,
              finalScoreCm: rules.maximumScoreCm,
              resultType: 'MAXIMUM',
              isBullseye: false,
              isDiscarded: false,
            },
          ],
        },
        {
          pilotId: 'p5',
          pilotNumber: 5,
          roundScores: [
            {
              pilotId: 'p5',
              roundId: 'r1',
              roundNumber: 1,
              finalScoreCm: 12,
              resultType: 'MEASURED',
              isBullseye: false,
              isDiscarded: false,
            },
          ],
        },
      ],
      rules,
    );
    expect(rankings[0].pilotId).toBe('p5');
    expect(rankings[1].pilotId).toBe('p30');
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

  it('fills all vacant scoring slots when the roster is empty (not a single max)', () => {
    const result = calculateTeamRoundScore(
      {
        teamId: 'empty',
        type: 'NATIONAL',
        members: [],
        scoringPilots: 3,
      },
      'r1',
      [],
      { ...rules, maximumScoreCm: 500 },
    );
    expect(result.countedPilots).toHaveLength(3);
    expect(result.totalScoreCm).toBe(1500);
  });

  it('sums best three real scores and discards the worst', () => {
    const result = calculateTeamRoundScore(
      {
        teamId: 'lachung',
        type: 'NATIONAL',
        members: [
          { pilotId: 'p1', role: 'PILOT', order: 1 },
          { pilotId: 'p2', role: 'PILOT', order: 2 },
          { pilotId: 'p3', role: 'PILOT', order: 3 },
          { pilotId: 'p4', role: 'PILOT', order: 4 },
        ],
        scoringPilots: 3,
      },
      'r1',
      [
        { pilotId: 'p1', scoreCm: 42, resultType: 'MEASURED', isCountable: true },
        { pilotId: 'p2', scoreCm: 12, resultType: 'MEASURED', isCountable: true },
        { pilotId: 'p3', scoreCm: 500, resultType: 'MEASURED', isCountable: true },
        { pilotId: 'p4', scoreCm: 1, resultType: 'MEASURED', isCountable: true },
      ],
      { ...rules, maximumScoreCm: 500 },
    );
    expect(result.totalScoreCm).toBe(55);
    expect(result.countedPilots).toHaveLength(3);
    expect(result.discardedPilots).toHaveLength(1);
    expect(result.discardedPilots[0].scoreCm).toBe(500);
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
