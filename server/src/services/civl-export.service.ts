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

function uniqueIds(ids: string[] | undefined): string[] {
  return [...new Set((ids ?? []).map((id) => id.trim()).filter((id) => id.length > 0))];
}

/**
 * Build a CIVL results workbook.
 * Round results accept several official rounds and write one column per round.
 */
export async function exportCivlSpreadsheet(
  competitionId: string,
  input: { reportType: CivlReportType; roundId?: string; roundIds?: string[] },
): Promise<{ buffer: Buffer; filename: string }> {
  if (input.reportType === 'OVERALL_RESULTS') {
    const built = await buildOverall(competitionId);
    return {
      buffer: await buildIndividualWorkbook(built.rows, built.roundLabels),
      filename: 'civl-individual-overall.xlsx',
    };
  }

  if (input.reportType === 'ROUND_RESULTS') {
    const ids = uniqueIds(input.roundIds);
    if (ids.length > 1) {
      const built = await buildSelectedRounds(competitionId, ids);
      return {
        buffer: await buildIndividualWorkbook(built.rows, built.roundLabels),
        filename: `civl-individual-rounds-${built.announced.join('-')}.xlsx`,
      };
    }
    const built = await buildRound(competitionId, ids[0] ?? input.roundId);
    return {
      buffer: await buildIndividualWorkbook(built.rows, []),
      filename: `civl-individual-round-${built.announced}.xlsx`,
    };
  }

  const built = await buildTeamRound(competitionId, input.roundId);
  return {
    buffer: await buildTeamWorkbook(built.groups, built.taskLabels),
    filename: `civl-team-round-${built.announced}.xlsx`,
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

/**
 * Custom CIVL individual sheet: one column per selected official round.
 * The score is the total of those rounds after the competition discard rules.
 * A finished round with no score counts as the maximum. An open round stays blank.
 */
async function buildSelectedRounds(
  competitionId: string,
  roundIds: string[],
): Promise<{ rows: CivlIndividualRow[]; roundLabels: string[]; announced: number[] }> {
  const competition = await getCompetition(competitionId);
  const catalogue = await officialRounds(competitionId);
  const selected: Array<Awaited<ReturnType<typeof requireOfficialRound>>> = [];
  for (const roundId of roundIds) {
    selected.push(await requireOfficialRound(competitionId, roundId));
  }
  selected.sort((a, b) => a.number - b.number);

  const scores = await prisma.score.findMany({
    where: {
      roundId: { in: selected.map((round) => round.id) },
      status: { in: [...SCORED_STATUSES] },
      finalScoreCm: { not: null },
      pilot: { status: { in: [...COMPETING_PILOT_STATUSES] } },
    },
    include: { pilot: { include: { country: true } } },
  });
  const scoreMap = new Map(scores.map((score) => [`${score.pilotId}:${score.roundId}`, score]));
  const pilots = new Map(scores.map((score) => [score.pilotId, score.pilot]));
  const rules = resolveCompetitionRules(
    competition.ruleSet,
    settingsToRuleOverrides(competition.settings),
  );
  const maxCm = rules.maximumScoreCm;
  const labeled = selected.map((round) => {
    const announced = officialDisplayNumber(catalogue, round.number) ?? round.number;
    return { round, announced, label: `Round ${announced}` };
  });

  const prepared = [...pilots.values()]
    .flatMap((pilot) => {
      const roundEntries = selected.flatMap((round) => {
        const existing = scoreMap.get(`${pilot.id}:${round.id}`);
        const isFinal = FINAL_ROUND_STATUSES.has(round.status);
        if (!existing && !isFinal) return [];
        return [
          {
            pilotId: pilot.id,
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
          },
        ];
      });
      const { kept, discarded } = applyDiscardRules(roundEntries, rules);
      if (kept.length === 0 && discarded.length === 0) return [];
      const total = kept.reduce((sum, score) => sum + score.finalScoreCm, 0);
      return [
        {
          pilot,
          pilotNumber: pilot.pilotNumber ?? Number.MAX_SAFE_INTEGER,
          total: scoreCm(total) ?? 0,
          rounds: selected.map((round) => {
            const existing = scoreMap.get(`${pilot.id}:${round.id}`);
            if (existing) return scoreCm(existing.finalScoreCm) ?? 0;
            return FINAL_ROUND_STATUSES.has(round.status) ? (scoreCm(maxCm) ?? maxCm) : null;
          }),
        },
      ];
    })
    .sort((a, b) => a.total - b.total || a.pilotNumber - b.pilotNumber);

  const ranks = competitionRanks(prepared.map((row) => row.total));
  return {
    announced: labeled.map((item) => item.announced),
    roundLabels: labeled.map((item) => item.label),
    rows: prepared.map((row, index) => ({
      rank: ranks[index] ?? index + 1,
      ...pilotFields(row.pilot),
      score: row.total,
      rounds: row.rounds,
    })),
  };
}

async function buildTeamRound(
  competitionId: string,
  roundId: string | undefined,
): Promise<{ groups: CivlTeamGroup[]; taskLabels: string[]; announced: number }> {
  const round = await requireOfficialRound(competitionId, roundId);
  await recalculateRankings(competitionId);
  const rounds = await officialRounds(competitionId);
  const announced = officialDisplayNumber(rounds, round.number) ?? round.number;

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
    where: { roundId: round.id, teamId: { in: teams.map((team) => team.id) } },
  });
  const scoreByTeam = new Map(teamScores.map((score) => [score.teamId, score]));

  const rawScores = await prisma.score.findMany({
    where: {
      roundId: round.id,
      status: { in: [...SCORED_STATUSES] },
      finalScoreCm: { not: null },
    },
    select: { pilotId: true, finalScoreCm: true },
  });
  const rawByPilot = new Map(rawScores.map((score) => [score.pilotId, score.finalScoreCm]));

  const groups = teams
    .flatMap((team) => {
      const teamScore = scoreByTeam.get(team.id);
      const total = scoreCm(teamScore?.totalScoreCm);
      const members = team.members.filter((member) => member.pilot);
      if (total == null || members.length === 0) return [];
      const contrib = new Map<string, number>();
      const counted = (teamScore?.countedPilots as Array<{ pilotId: string; scoreCm: number }> | null) ?? [];
      const discarded = (teamScore?.discardedPilots as Array<{ pilotId: string; scoreCm: number }> | null) ?? [];
      for (const entry of [...counted, ...discarded]) {
        const value = scoreCm(entry.scoreCm);
        if (value != null) contrib.set(entry.pilotId, value);
      }
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
              tasks: [contrib.get(member.pilot.id) ?? scoreCm(rawByPilot.get(member.pilot.id))],
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

  return { groups, taskLabels: [`T ${announced}`], announced };
}
