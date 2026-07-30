import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScoringEngine } from '@npha/scoring-engine';

vi.mock('../config/prisma.js', () => ({
  prisma: {
    competition: { findUnique: vi.fn() },
    pilot: { findMany: vi.fn() },
    team: { findMany: vi.fn() },
    round: { findMany: vi.fn() },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        individualRanking: { deleteMany: vi.fn(), createMany: vi.fn() },
        teamRanking: { deleteMany: vi.fn(), createMany: vi.fn() },
        teamScore: { deleteMany: vi.fn(), create: vi.fn() },
        result: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
      }),
    ),
  },
}));

vi.mock('../services/competition.service.js', () => ({
  getCompetition: vi.fn().mockResolvedValue({
    id: 'comp-1',
    ruleSet: 'FAI_2022',
    settings: {
      bullseyeScoreCm: 0,
      maximumScoreCm: 1000,
      discardWorstRounds: 0,
      discardAfterRounds: 5,
      allowReflights: true,
      maxReflightsPerRound: 1,
      teamSize: 4,
      teamScoringPilots: 3,
      teamAllowReserves: true,
      teamMaxReserves: 1,
      womenCategoryEnabled: true,
      juniorCategoryEnabled: true,
      juniorMaxAge: 25,
      countryRankingEnabled: true,
      customRulesJson: null,
      tieBreakRulesJson: null,
    },
  }),
  settingsToRuleOverrides: vi.fn().mockReturnValue({}),
}));

vi.mock('../services/score.service.js', () => ({
  buildRoundScoreEntries: vi.fn().mockResolvedValue({
    rules: ScoringEngine.resolveRules('FAI_2022'),
    pilots: [
      {
        pilotId: 'p1',
        pilotNumber: 1,
        gender: 'MALE',
        isJunior: false,
        isWomen: false,
        countryId: 'c1',
        status: 'ACTIVE',
        roundScores: [
          {
            pilotId: 'p1',
            roundId: 'r1',
            roundNumber: 1,
            finalScoreCm: 120,
            resultType: 'MEASURED',
            isBullseye: false,
            isDiscarded: false,
          },
        ],
      },
      {
        pilotId: 'p2',
        pilotNumber: 2,
        gender: 'MALE',
        isJunior: false,
        isWomen: false,
        countryId: 'c1',
        status: 'ACTIVE',
        roundScores: [
          {
            pilotId: 'p2',
            roundId: 'r1',
            roundNumber: 1,
            finalScoreCm: 80,
            resultType: 'MEASURED',
            isBullseye: false,
            isDiscarded: false,
          },
        ],
      },
    ],
  }),
}));

import { prisma } from '../config/prisma.js';
import { recalculateRankings } from '../services/scoring.service.js';

describe('scoring.service', () => {
  beforeEach(() => {
    vi.mocked(prisma.team.findMany).mockResolvedValue([]);
    vi.mocked(prisma.round.findMany).mockResolvedValue([]);
  });

  it('recalculates individual rankings using ScoringEngine', async () => {
    const result = await recalculateRankings('comp-1');
    expect(result.competitionId).toBe('comp-1');
    expect(result.individualCount).toBeGreaterThan(0);
    expect(result.categories).toContain('OVERALL');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('uses ScoringEngine facade for flight score computation', () => {
    const rules = ScoringEngine.resolveRules('FAI_2022');
    const computed = ScoringEngine.computeFlightScore(
      {
        pilotId: 'p1',
        roundId: 'r1',
        distanceCm: 0,
        resultType: 'BULLSEYE',
      },
      rules,
    );
    expect(computed.finalScoreCm).toBe(0);
    expect(computed.isBullseye).toBe(true);
  });
});
