import { ScoringEngine } from '@npha/scoring-engine';
import type { RankingCategory, TeamRoundScoreResult } from '@npha/shared';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { getCompetition } from './competition.service.js';
import { assignMissingScoresAsDnf, buildRoundScoreEntries } from './score.service.js';

export interface RecalculateResult {
  competitionId: string;
  categories: RankingCategory[];
  individualCount: number;
  teamCount: number;
  countryCount: number;
  calculatedAt: Date;
}

export async function recalculateRankings(competitionId: string): Promise<RecalculateResult> {
  const competition = await getCompetition(competitionId);

  // Persist DNF/max for unscored flights on approved rounds only (locked is immutable)
  const rankingRounds = await prisma.round.findMany({
    where: {
      competitionId,
      type: 'OFFICIAL',
      status: 'APPROVED',
    },
    select: { id: true },
  });
  for (const round of rankingRounds) {
    await assignMissingScoresAsDnf(competitionId, round.id);
  }

  const { pilots, rules } = await buildRoundScoreEntries(competitionId);

  const categories: RankingCategory[] = ['OVERALL'];
  if (rules.womenCategoryEnabled) categories.push('WOMEN');
  if (rules.juniorCategoryEnabled) categories.push('JUNIOR');

  const allIndividual: Array<ReturnType<typeof ScoringEngine.calculateIndividualRankings>[number] & { category: RankingCategory }> = [];

  for (const category of categories) {
    const rankings = ScoringEngine.calculateIndividualRankings(pilots, rules, category);
    for (const r of rankings) {
      allIndividual.push({ ...r, category });
    }
  }

  const countryRankings = competition.settings?.countryRankingEnabled
    ? ScoringEngine.calculateCountryRankings(
        pilots,
        allIndividual.filter((r) => r.category === 'OVERALL'),
        rules.teamScoringPilots,
      )
    : [];

  const teams = await prisma.team.findMany({
    where: { competitionId },
    include: { members: true },
  });

  const rounds = await prisma.round.findMany({
    where: { competitionId, type: 'OFFICIAL', status: { in: ['APPROVED', 'LOCKED'] } },
  });

  const teamRoundResults: TeamRoundScoreResult[] = [];
  for (const round of rounds) {
    for (const team of teams) {
      const pilotScores = team.members.map((m) => {
        const pilot = pilots.find((p) => p.pilotId === m.pilotId);
        const roundScore = pilot?.roundScores.find((rs) => rs.roundId === round.id);
        return {
          pilotId: m.pilotId,
          scoreCm: roundScore?.finalScoreCm ?? rules.maximumScoreCm,
          resultType: roundScore?.resultType ?? 'ABS',
          isCountable: !!roundScore,
          status: pilot?.status,
        };
      });

      const result = ScoringEngine.calculateTeamRoundScore(
        {
          teamId: team.id,
          type: team.type,
          scoringPilots: team.scoringPilots,
          maxReserves: team.maxReserves,
          members: team.members.map((m) => ({
            pilotId: m.pilotId,
            role: m.role,
            order: m.order,
          })),
        },
        round.id,
        pilotScores,
        rules,
      );
      teamRoundResults.push(result);
    }
  }

  const teamRankings = ScoringEngine.calculateTeamRankings(
    teams.map((t) => ({
      teamId: t.id,
      type: t.type,
      members: t.members.map((m) => ({ pilotId: m.pilotId, role: m.role, order: m.order })),
      scoringPilots: t.scoringPilots,
      maxReserves: t.maxReserves,
    })),
    teamRoundResults,
    rules,
    'TEAM',
  );

  const calculatedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.individualRanking.deleteMany({ where: { competitionId } });
    await tx.teamRanking.deleteMany({ where: { competitionId } });
    await tx.teamScore.deleteMany({
      where: { team: { competitionId } },
    });

    if (allIndividual.length) {
      await tx.individualRanking.createMany({
        data: allIndividual.map((r) => ({
          competitionId,
          pilotId: r.pilotId,
          category: r.category,
          rank: r.rank,
          totalScoreCm: r.totalScoreCm,
          roundsFlown: r.roundsFlown,
          bullseyes: r.bullseyes,
          discardedScoreCm: r.discardedScoreCm,
          tieBreakNotes: r.tieBreakNotes,
          auditJson: r.audit as object,
          calculatedAt,
        })),
      });
    }

    for (const tr of teamRoundResults) {
      await tx.teamScore.create({
        data: {
          teamId: tr.teamId,
          roundId: tr.roundId,
          totalScoreCm: tr.totalScoreCm,
          countedPilots: tr.countedPilots as object,
          discardedPilots: tr.discardedPilots as object,
          auditJson: tr.audit as object,
          calculatedAt,
        },
      });
    }

    if (teamRankings.length) {
      await tx.teamRanking.createMany({
        data: teamRankings.map((r) => ({
          competitionId,
          teamId: r.teamId,
          category: r.category,
          rank: r.rank,
          totalScoreCm: r.totalScoreCm,
          roundsScored: r.roundsScored,
          tieBreakNotes: r.tieBreakNotes,
          auditJson: r.audit as object,
          calculatedAt,
        })),
      });
    }

    const resultPayloads: Array<{ category: string; payload: unknown }> = [
      { category: 'OVERALL', payload: allIndividual.filter((r) => r.category === 'OVERALL') },
      { category: 'WOMEN', payload: allIndividual.filter((r) => r.category === 'WOMEN') },
      { category: 'JUNIOR', payload: allIndividual.filter((r) => r.category === 'JUNIOR') },
      { category: 'TEAM', payload: teamRankings },
      { category: 'COUNTRY', payload: countryRankings },
    ];

    for (const { category, payload } of resultPayloads) {
      const existing = await tx.result.findFirst({
        where: { competitionId, category, roundId: null },
      });
      if (existing) {
        await tx.result.update({
          where: { id: existing.id },
          data: {
            payloadJson: payload as object,
            version: { increment: 1 },
            updatedAt: calculatedAt,
          },
        });
      } else {
        await tx.result.create({
          data: {
            competitionId,
            category,
            payloadJson: payload as object,
            isOfficial: false,
          },
        });
      }
    }
  });

  return {
    competitionId,
    categories,
    individualCount: allIndividual.length,
    teamCount: teamRankings.length,
    countryCount: countryRankings.length,
    calculatedAt,
  };
}

export async function getIndividualRankings(
  competitionId: string,
  category: RankingCategory = 'OVERALL',
) {
  await getCompetition(competitionId);
  return prisma.individualRanking.findMany({
    where: { competitionId, category },
    orderBy: { rank: 'asc' },
    include: {
      pilot: { include: { country: true } },
    },
  });
}

export async function getTeamRankings(competitionId: string) {
  await getCompetition(competitionId);
  return prisma.teamRanking.findMany({
    where: { competitionId },
    orderBy: { rank: 'asc' },
    include: { team: { include: { country: true } } },
  });
}

export async function getCountryRankings(competitionId: string) {
  const result = await prisma.result.findFirst({
    where: { competitionId, category: 'COUNTRY', roundId: null },
  });
  if (!result) return [];
  return result.payloadJson ?? [];
}

export async function getWomenRankings(competitionId: string) {
  return getIndividualRankings(competitionId, 'WOMEN');
}

export async function publishResults(competitionId: string, category: string) {
  await getCompetition(competitionId);
  const result = await prisma.result.findFirst({
    where: { competitionId, category, roundId: null },
  });
  if (!result) throw AppError.notFound('Results not found for category');

  return prisma.result.update({
    where: { id: result.id },
    data: { isOfficial: true, publishedAt: new Date() },
  });
}
