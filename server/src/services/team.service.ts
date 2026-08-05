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
    memberPilotIds?: string[];
    captainId?: string;
    viceCaptainId?: string;
  },
) {
  const competition = await getCompetition(competitionId);
  const settings = competition.settings;
  const maxSize = settings?.teamSize ?? 4;
  const scoringPilots = settings?.teamScoringPilots ?? 3;
  const maxReserves = settings?.teamMaxReserves ?? 1;

  const team = await prisma.team.create({
    data: {
      competitionId,
      name: data.name,
      type: (data.type ?? 'NATIONAL') as Prisma.TeamCreateInput['type'],
      countryId: data.countryId,
      maxSize,
      scoringPilots,
      maxReserves,
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
  // Team size / scoring / reserves are competition settings — ignore per-team overrides
  const {
    maxSize: _maxSize,
    scoringPilots: _scoringPilots,
    maxReserves: _maxReserves,
    ...safeData
  } = data as Prisma.TeamUpdateInput & {
    maxSize?: unknown;
    scoringPilots?: unknown;
    maxReserves?: unknown;
  };
  await prisma.team.update({ where: { id: teamId }, data: safeData });
  return getTeam(competitionId, teamId);
}

export async function deleteTeam(competitionId: string, teamId: string): Promise<void> {
  await getTeam(competitionId, teamId);
  await prisma.team.delete({ where: { id: teamId } });
  const { recalculateRankings } = await import('./scoring.service.js');
  await recalculateRankings(competitionId);
}

export async function setTeamMembers(
  competitionId: string,
  teamId: string,
  pilotIds: string[],
  roles?: Array<'PILOT' | 'RESERVE' | 'CAPTAIN' | 'VICE_CAPTAIN'>,
) {
  await getTeam(competitionId, teamId);
  const competition = await getCompetition(competitionId);
  const rules = ScoringEngine.resolveRules(
    competition.ruleSet,
    settingsToRuleOverrides(competition.settings),
  );

  const uniqueIds = [...new Set(pilotIds)];
  if (uniqueIds.length !== pilotIds.length) {
    throw AppError.badRequest('Duplicate pilots are not allowed on a team');
  }

  const maxMembers = rules.teamSize + (rules.teamAllowReserves ? rules.teamMaxReserves : 0);
  if (uniqueIds.length > maxMembers) {
    throw AppError.badRequest(
      `Team may have at most ${maxMembers} members (${rules.teamSize} pilots` +
        (rules.teamAllowReserves ? ` + ${rules.teamMaxReserves} reserves` : '') +
        `) per competition settings`,
    );
  }

  const reserveCount = (roles ?? []).filter((r) => r === 'RESERVE').length;
  if (!rules.teamAllowReserves && reserveCount > 0) {
    throw AppError.badRequest('Reserves are disabled in competition settings');
  }
  if (reserveCount > rules.teamMaxReserves) {
    throw AppError.badRequest(
      `At most ${rules.teamMaxReserves} reserve(s) allowed by competition settings`,
    );
  }

  const pilots = await prisma.pilot.findMany({
    where: { id: { in: uniqueIds }, competitionId },
  });
  if (pilots.length !== uniqueIds.length) {
    throw AppError.badRequest('One or more pilots not found in this competition');
  }

  const alreadyAssigned = await prisma.teamMember.findMany({
    where: {
      pilotId: { in: uniqueIds },
      teamId: { not: teamId },
      team: { competitionId },
    },
    include: {
      pilot: { select: { pilotNumber: true, firstName: true, lastName: true } },
      team: { select: { name: true } },
    },
  });

  if (alreadyAssigned.length > 0) {
    const details = alreadyAssigned
      .map(
        (m) =>
          `#${m.pilot.pilotNumber} ${m.pilot.firstName} ${m.pilot.lastName} is already on ${m.team.name}`,
      )
      .join('; ');
    throw AppError.badRequest(`Pilots can only belong to one team. ${details}`);
  }

  await prisma.teamMember.deleteMany({ where: { teamId } });
  await prisma.teamMember.createMany({
    data: uniqueIds.map((pilotId, index) => ({
      teamId,
      pilotId,
      role: roles?.[index] ?? 'PILOT',
      order: index + 1,
    })),
  });

  const validation = await validateTeam(competitionId, teamId);

  // Roster changes invalidate stored team round totals — recalculate so public
  // boards don't keep empty-roster maxima (especially after late team setup).
  const { recalculateRankings } = await import('./scoring.service.js');
  await recalculateRankings(competitionId);

  return validation;
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
    // Always use competition rules — not per-team overrides
    scoringPilots: rules.teamScoringPilots,
    maxReserves: rules.teamAllowReserves ? rules.teamMaxReserves : 0,
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
      maxSize: rules.teamSize,
      scoringPilots: rules.teamScoringPilots,
      maxReserves: rules.teamAllowReserves ? rules.teamMaxReserves : 0,
    },
  });

  return { ...result, teamId };
}

export async function syncTeamLimitsFromSettings(competitionId: string): Promise<void> {
  const competition = await getCompetition(competitionId);
  const settings = competition.settings;
  if (!settings) return;

  await prisma.team.updateMany({
    where: { competitionId },
    data: {
      maxSize: settings.teamSize,
      scoringPilots: settings.teamScoringPilots,
      maxReserves: settings.teamAllowReserves ? settings.teamMaxReserves : 0,
    },
  });
}
