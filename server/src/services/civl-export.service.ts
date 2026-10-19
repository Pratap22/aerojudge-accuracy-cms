import { applyDiscardRules, resolveCompetitionRules } from '@aero-judge/scoring-engine';
import { COMPETING_PILOT_STATUSES } from '@aero-judge/shared';
import { officialDisplayNumber } from '@aero-judge/utils';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { getCompetition, settingsToRuleOverrides } from './competition.service.js';
import { recalculateRankings, getIndividualRankings } from './scoring.service.js';
import {
  buildIndividualWorkbook,
  buildTeamWorkbook,
  civlGender,
  civlNationCode,
  civlPilotNumber,
  civlTaskCell,
  competitionRanks,
  type CivlIndividualRow,
  type CivlPilotFields,
  type CivlTeamGroup,
} from './civl-workbook.js';

const FINAL_ROUND_STATUSES = new Set(['CLOSED', 'PENDING_APPROVAL', 'APPROVED', 'LOCKED']);
const SCORED_STATUSES = ['ENTERED', 'CONFIRMED', 'APPROVED', 'LOCKED'] as const;

type CivlReportType = 'OVERALL_RESULTS' | 'ROUND_RESULTS' | 'TEAM_RESULTS';

interface PilotIdentity {
  id: string;
  pilotNumber: number | null;
  firstName: string;
  lastName: string;
  gender: string;
  nationality: string | null;
  civlId: string | null;
  glider: string | null;
  harness: string | null;
  club: string | null;
  country: { code: string } | null;
}

export async function exportCivlSpreadsheet(
  competitionId: string,
  input: { reportType: CivlReportType; roundId?: string },
): Promise<{ buffer: Buffer; filename: string }> {
  if (input.reportType === 'OVERALL_RESULTS') {
    const built = await buildOverall(competitionId);
    return {
      buffer: await buildIndividualWorkbook(built.rows, built.roundLabels),
      filename: 'civl-individual-overall.xlsx',
    };
  }

  if (input.reportType === 'ROUND_RESULTS') {
    const built = await buildRound(competitionId, input.roundId);
    return {
      buffer: await buildIndividualWorkbook(built.rows, []),
      filename: `civl-individual-round-${built.announced}.xlsx`,
    };
  }

  const built = await buildTeamRound(competitionId, input.roundId);
  return {
    buffer: await buildTeamWorkbook(built.groups, built.taskLabels),
    filename: input.roundId
      ? `civl-team-round-${built.announced}.xlsx`
      : 'civl-team-overall.xlsx',
  };
}

function pilotFields(pilot: PilotIdentity): CivlPilotFields {
  return {
    number: civlPilotNumber(pilot.pilotNumber),
    firstName: pilot.firstName.trim(),
    lastName: pilot.lastName.trim(),
    nat: civlNationCode(pilot.country?.code ?? pilot.nationality),
    gender: civlGender(pilot.gender),
    wingManufacturer: '',
    wingModel: pilot.glider?.trim() ?? '',
    pgCertification: '',
    harnessManufacturer: '',
    harnessModel: pilot.harness?.trim() ?? '',
    sponsor: pilot.club?.trim() ?? '',
    civlId: pilot.civlId?.trim() ?? '',
  };
}

function scoreCm(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value);
}

async function officialRounds(competitionId: string) {
  return prisma.round.findMany({
    where: { competitionId, type: 'OFFICIAL' },
    orderBy: { number: 'asc' },
    select: { id: true, number: true, type: true, status: true },
  });
}

async function lastCompletedOfficialRound(competitionId: string) {
  const rounds = await officialRounds(competitionId);
  const last = [...rounds].reverse().find((round) => FINAL_ROUND_STATUSES.has(round.status));
  if (!last) {
    throw AppError.badRequest('No completed official rounds to export.');
  }
  return last;
}

async function requireOfficialRound(competitionId: string, roundId: string | undefined) {
  if (!roundId) {
    throw AppError.badRequest('Choose an official round to export.');
  }
  const round = await prisma.round.findFirst({
    where: { id: roundId, competitionId },
  });
  if (!round) throw AppError.notFound('Round not found');
  if (round.type !== 'OFFICIAL') {
    throw AppError.badRequest('CIVL spreadsheets are for official rounds.');
  }
  return round;
}

async function buildOverall(competitionId: string): Promise<{
  rows: CivlIndividualRow[];
  roundLabels: string[];
}> {
  const competition = await getCompetition(competitionId);
  await recalculateRankings(competitionId);
  const rankings = await getIndividualRankings(competitionId, 'OVERALL');
  const rounds = await officialRounds(competitionId);
  const closed = rounds.filter((round) => FINAL_ROUND_STATUSES.has(round.status));
  if (closed.length === 0) {
    throw AppError.badRequest('No completed official rounds to export.');
  }

  const scores = await prisma.score.findMany({
    where: {
      roundId: { in: closed.map((round) => round.id) },
      status: { in: [...SCORED_STATUSES] },
      finalScoreCm: { not: null },
    },
    select: { pilotId: true, roundId: true, finalScoreCm: true, resultType: true, isBullseye: true },
  });
  const scoreMap = new Map(scores.map((score) => [`${score.pilotId}:${score.roundId}`, score]));
  const rules = resolveCompetitionRules(
    competition.ruleSet,
    settingsToRuleOverrides(competition.settings),
  );
  const maxCm = rules.maximumScoreCm;
  const roundLabels = closed.map((round) => {
    const announced = officialDisplayNumber(rounds, round.number) ?? round.number;
    return `Round ${announced}`;
  });

  const prepared = rankings
    .filter((ranking) => ranking.roundsFlown > 0)
    .flatMap((ranking) => {
      const roundEntries = closed.map((round) => {
        const existing = scoreMap.get(`${ranking.pilotId}:${round.id}`);
        return {
          pilotId: ranking.pilotId,
          roundId: round.id,
          roundNumber: round.number,
          finalScoreCm: existing?.finalScoreCm ?? maxCm,
          resultType: (existing?.resultType ?? 'DNF') as
            | 'MEASURED'
            | 'BULLSEYE'
            | 'MAXIMUM'
            | 'DNF'
            | 'ABS'
            | 'DNS'
            | 'DSQ'
            | 'REFLIGHT'
            | 'PENALTY',
          isBullseye: existing?.isBullseye ?? false,
          isDiscarded: false,
          isProvisional: false,
        };
      });
      const { kept, discarded } = applyDiscardRules(roundEntries, rules);
      if (kept.length === 0 && discarded.length === 0) return [];
      const total = kept.reduce((sum, score) => sum + score.finalScoreCm, 0);
      return [
        {
          pilot: ranking.pilot,
          pilotNumber: ranking.pilot.pilotNumber ?? 0,
          total: scoreCm(total) ?? 0,
          rounds: closed.map((round) => scoreCm(scoreMap.get(`${ranking.pilotId}:${round.id}`)?.finalScoreCm ?? maxCm) ?? 0),
        },
      ];
    })
    .sort((a, b) => a.total - b.total || a.pilotNumber - b.pilotNumber);

  const ranks = competitionRanks(prepared.map((row) => row.total));
  return {
    roundLabels,
    rows: prepared.map((row, index) => ({
      rank: ranks[index] ?? index + 1,
      ...pilotFields(row.pilot),
      score: row.total,
      rounds: row.rounds,
    })),
  };
}

async function buildRound(
  competitionId: string,
  roundId: string | undefined,
): Promise<{ rows: CivlIndividualRow[]; announced: number }> {
  const round = await requireOfficialRound(competitionId, roundId);
  const rounds = await officialRounds(competitionId);
  const announced = officialDisplayNumber(rounds, round.number) ?? round.number;
  const scores = await prisma.score.findMany({
    where: {
      roundId: round.id,
      status: { in: [...SCORED_STATUSES] },
      finalScoreCm: { not: null },
      pilot: { status: { in: [...COMPETING_PILOT_STATUSES] } },
    },
    include: { pilot: { include: { country: true } } },
  });

  const prepared = scores
    .map((score) => ({
      pilot: score.pilot,
      pilotNumber: score.pilot.pilotNumber ?? Number.MAX_SAFE_INTEGER,
      total: scoreCm(score.finalScoreCm) ?? 0,
    }))
    .sort((a, b) => a.total - b.total || a.pilotNumber - b.pilotNumber);
  const ranks = competitionRanks(prepared.map((row) => row.total));

  return {
    announced,
    rows: prepared.map((row, index) => ({
      rank: ranks[index] ?? index + 1,
      ...pilotFields(row.pilot),
      score: row.total,
      rounds: [],
    })),
  };
}

type PilotContrib = { pilotId: string; scoreCm: number };

interface RoundTeamScore {
  total: number;
  counted: Map<string, number>;
  discarded: Map<string, number>;
}

/**
 * Team sheet for CIVL.
 * With a round, columns run from T 1 through that round.
 * With no round, columns cover every completed official round. That is the
 * Competition results team file. Score is the sum of those team totals.
 * A pilot score that was not counted is marked with d.
 */
async function buildTeamRound(
  competitionId: string,
  roundId: string | undefined,
): Promise<{ groups: CivlTeamGroup[]; taskLabels: string[]; announced: number }> {
  const round = roundId
    ? await requireOfficialRound(competitionId, roundId)
    : await lastCompletedOfficialRound(competitionId);
  await recalculateRankings(competitionId);
  const rounds = await officialRounds(competitionId);
  const announced = officialDisplayNumber(rounds, round.number) ?? round.number;
  const through = rounds.filter((candidate) => {
    const display = officialDisplayNumber(rounds, candidate.number) ?? candidate.number;
    return display <= announced;
  });
  const finalRounds = through.filter((candidate) => FINAL_ROUND_STATUSES.has(candidate.status));

  const teams = await prisma.team.findMany({
    where: { competitionId },
    include: {
      members: {
        include: { pilot: { include: { country: true } } },
        orderBy: { order: 'asc' },
      },
    },
  });
  const teamScores = await prisma.teamScore.findMany({
    where: {
      roundId: { in: finalRounds.map((candidate) => candidate.id) },
      teamId: { in: teams.map((team) => team.id) },
    },
  });
  const byTeamRound = new Map<string, RoundTeamScore>();
  for (const teamScore of teamScores) {
    const total = scoreCm(teamScore.totalScoreCm);
    if (total == null) continue;
    const counted = new Map<string, number>();
    const discarded = new Map<string, number>();
    const countedRows = (teamScore.countedPilots as PilotContrib[] | null) ?? [];
    const discardedRows = (teamScore.discardedPilots as PilotContrib[] | null) ?? [];
    for (const entry of countedRows) {
      if (entry.pilotId.startsWith('MISSING_')) continue;
      const value = scoreCm(entry.scoreCm);
      if (value != null) counted.set(entry.pilotId, value);
    }
    for (const entry of discardedRows) {
      const value = scoreCm(entry.scoreCm);
      if (value != null) discarded.set(entry.pilotId, value);
    }
    byTeamRound.set(`${teamScore.teamId}:${teamScore.roundId}`, { total, counted, discarded });
  }

  const rawScores = await prisma.score.findMany({
    where: {
      roundId: { in: finalRounds.map((candidate) => candidate.id) },
      status: { in: [...SCORED_STATUSES] },
      finalScoreCm: { not: null },
    },
    select: { pilotId: true, roundId: true, finalScoreCm: true },
  });
  const rawByPilotRound = new Map(
    rawScores.map((score) => [`${score.pilotId}:${score.roundId}`, score.finalScoreCm]),
  );

  const taskLabels = through.map((candidate) => {
    const display = officialDisplayNumber(rounds, candidate.number) ?? candidate.number;
    return `T ${display}`;
  });

  const groups = teams
    .flatMap((team) => {
      const members = team.members.filter((member) => member.pilot);
      if (members.length === 0) return [];
      let total = 0;
      let scoredRounds = 0;
      for (const candidate of through) {
        const record = byTeamRound.get(`${team.id}:${candidate.id}`);
        if (!record) continue;
        total += record.total;
        scoredRounds += 1;
      }
      if (scoredRounds === 0) return [];
      return [
        {
          name: team.name,
          score: total,
          members: [...members]
            .sort(
              (a, b) =>
                (a.pilot.pilotNumber ?? Number.MAX_SAFE_INTEGER) -
                (b.pilot.pilotNumber ?? Number.MAX_SAFE_INTEGER),
            )
            .map((member) => ({
              ...pilotFields(member.pilot),
              tasks: through.map((candidate) => {
                const record = byTeamRound.get(`${team.id}:${candidate.id}`);
                if (!record) return null;
                if (record.counted.has(member.pilot.id)) {
                  return civlTaskCell(record.counted.get(member.pilot.id), true);
                }
                if (record.discarded.has(member.pilot.id)) {
                  return civlTaskCell(record.discarded.get(member.pilot.id), false);
                }
                const raw = scoreCm(rawByPilotRound.get(`${member.pilot.id}:${candidate.id}`));
                return raw == null ? null : civlTaskCell(raw, false);
              }),
            })),
        },
      ];
    })
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
    .map((group, index) => ({
      rank: index + 1,
      name: group.name,
      score: group.score,
      members: group.members,
    }));

  if (groups.length === 0) {
    throw AppError.badRequest('No completed team scores to export through this round.');
  }

  return { groups, taskLabels, announced };
}
