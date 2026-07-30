import { ScoringEngine } from '@npha/scoring-engine';
import type { Prisma } from '@npha/database';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { getCompetition, settingsToRuleOverrides } from './competition.service.js';

export async function listTeams(
  competitionId: string,
  query: { page: number; pageSize: number; search?: string },
) {
  await getCompetition(competitionId);
  const where: Prisma.TeamWhereInput = { competitionId };
  if (query.search) {
    where.name = { contains: query.search, mode: 'insensitive' };
  }

  const [items, total] = await Promise.all([
    prisma.team.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { name: 'asc' },
      include: { members: { include: { pilot: true } }, country: true },
    }),
    prisma.team.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getTeam(competitionId: string, teamId: string) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, competitionId },
    include: {
      members: { include: { pilot: true }, orderBy: { order: 'asc' } },
      country: true,
    },
  });
  if (!team) throw AppError.notFound('Team not found');
  return team;
}

export async function createTeam(
  competitionId: string,
  data: {
    name: string;
    type?: string;
    countryId?: string;
    maxSize?: number;
    scoringPilots?: number;
    maxReserves?: number;
    memberPilotIds?: string[];
    captainId?: string;
    viceCaptainId?: string;
  },
) {
  await getCompetition(competitionId);

  const team = await prisma.team.create({
    data: {
      competitionId,
      name: data.name,
      type: (data.type ?? 'NATIONAL') as Prisma.TeamCreateInput['type'],
      countryId: data.countryId,
      maxSize: data.maxSize ?? 4,
      scoringPilots: data.scoringPilots ?? 3,
      maxReserves: data.maxReserves ?? 1,
      captainId: data.captainId,
      viceCaptainId: data.viceCaptainId,
    },
  });

  if (data.memberPilotIds?.length) {
    await setTeamMembers(competitionId, team.id, data.memberPilotIds);
  }

  return getTeam(competitionId, team.id);
}

export async function updateTeam(
  competitionId: string,
  teamId: string,
  data: Prisma.TeamUpdateInput,
) {
  await getTeam(competitionId, teamId);
  await prisma.team.update({ where: { id: teamId }, data });
  return getTeam(competitionId, teamId);
}

export async function deleteTeam(competitionId: string, teamId: string): Promise<void> {
  await getTeam(competitionId, teamId);
  await prisma.team.delete({ where: { id: teamId } });
}

export async function setTeamMembers(
  competitionId: string,
  teamId: string,
  pilotIds: string[],
  roles?: Array<'PILOT' | 'RESERVE' | 'CAPTAIN' | 'VICE_CAPTAIN'>,
) {
  await getTeam(competitionId, teamId);

  const pilots = await prisma.pilot.findMany({
    where: { id: { in: pilotIds }, competitionId },
  });
  if (pilots.length !== pilotIds.length) {
    throw AppError.badRequest('One or more pilots not found in this competition');
  }

  await prisma.teamMember.deleteMany({ where: { teamId } });
  await prisma.teamMember.createMany({
    data: pilotIds.map((pilotId, index) => ({
      teamId,
      pilotId,
      role: roles?.[index] ?? 'PILOT',
      order: index + 1,
    })),
  });

  return validateTeam(competitionId, teamId);
}

export async function validateTeam(competitionId: string, teamId: string) {
  const team = await getTeam(competitionId, teamId);
  const competition = await getCompetition(competitionId);
  const rules = ScoringEngine.resolveRules(
    competition.ruleSet,
    settingsToRuleOverrides(competition.settings),
  );

  const teamInput = {
    teamId: team.id,
    type: team.type,
    scoringPilots: team.scoringPilots,
    maxReserves: team.maxReserves,
    members: team.members.map((m) => ({
      pilotId: m.pilotId,
      role: m.role,
      order: m.order,
    })),
  };

  const result = ScoringEngine.validateTeamComposition(teamInput, rules);

  await prisma.team.update({
    where: { id: teamId },
    data: {
      isValid: result.isValid,
      validationNotes: result.errors.join('; ') || null,
    },
  });

  return { ...result, teamId };
}
