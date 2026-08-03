import type { CompetitionRole, CompetitionParticipationStatus } from '@npha/database';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { getCompetition } from './competition.service.js';
import { getPerson } from './person.service.js';

export const PILOT_ROLES: CompetitionRole[] = ['PILOT'];

export const JUDGE_OFFICIAL_ROLES: CompetitionRole[] = [
  'CHIEF_JUDGE',
  'TARGET_JUDGE',
  'JUDGE',
  'MEET_DIRECTOR',
  'SCORER',
  'ANNOUNCER',
  'DISPLAY_OPERATOR',
  'LAUNCH_MARSHAL',
  'GOAL_MARSHAL',
  'REGISTRATION_OFFICER',
  'SAFETY_DIRECTOR',
  'TECHNICAL_DELEGATE',
  'VIEWER',
  'OTHER',
];

export function isPilotRole(role: CompetitionRole): boolean {
  return PILOT_ROLES.includes(role);
}

export function isJudgeOrOfficialRole(role: CompetitionRole): boolean {
  return JUDGE_OFFICIAL_ROLES.includes(role);
}

/** Product policy: cannot be both Pilot and Judge/Official in the same competition. */
export function assertPilotJudgePolicy(
  existingRoles: CompetitionRole[],
  newRole: CompetitionRole,
): void {
  const wouldBePilot = isPilotRole(newRole) || existingRoles.some(isPilotRole);
  const wouldBeOfficial = isJudgeOrOfficialRole(newRole) || existingRoles.some(isJudgeOrOfficialRole);
  if (wouldBePilot && wouldBeOfficial) {
    // Allow if new role is same family as existing only
    const existingHasPilot = existingRoles.some(isPilotRole);
    const existingHasOfficial = existingRoles.some(isJudgeOrOfficialRole);
    if (
      (isPilotRole(newRole) && existingHasOfficial) ||
      (isJudgeOrOfficialRole(newRole) && existingHasPilot)
    ) {
      throw AppError.conflict(
        'A person cannot be both a pilot and a judge/official in the same competition',
      );
    }
  }
}

export async function getOrCreateParticipant(
  competitionId: string,
  personId: string,
  opts?: { status?: CompetitionParticipationStatus; notes?: string },
) {
  await getCompetition(competitionId);
  await getPerson(personId);

  const existing = await prisma.competitionParticipant.findUnique({
    where: { competitionId_personId: { competitionId, personId } },
    include: { roles: true },
  });
  if (existing) return existing;

  return prisma.competitionParticipant.create({
    data: {
      competitionId,
      personId,
      status: opts?.status ?? 'REGISTERED',
      notes: opts?.notes,
    },
    include: { roles: true },
  });
}

export async function assignCompetitionRole(
  competitionId: string,
  personId: string,
  role: CompetitionRole,
  opts?: { notes?: string; actorUserId?: string },
) {
  const participant = await getOrCreateParticipant(competitionId, personId);
  const existingRoles = participant.roles.map((r) => r.role);

  if (existingRoles.includes(role)) {
    return participant;
  }

  assertPilotJudgePolicy(existingRoles, role);

  await prisma.competitionParticipantRole.create({
    data: {
      competitionParticipantId: participant.id,
      role,
      notes: opts?.notes,
    },
  });

  if (opts?.actorUserId) {
    await prisma.auditLog.create({
      data: {
        competitionId,
        userId: opts.actorUserId,
        action: 'COMPETITION_ROLE_ASSIGNED',
        entityType: 'CompetitionParticipant',
        entityId: participant.id,
        afterJson: { personId, role },
      },
    });
  }

  return prisma.competitionParticipant.findUniqueOrThrow({
    where: { id: participant.id },
    include: { roles: true, person: true },
  });
}

export async function removeCompetitionRole(
  competitionId: string,
  personId: string,
  role: CompetitionRole,
  opts?: { actorUserId?: string },
) {
  const participant = await prisma.competitionParticipant.findUnique({
    where: { competitionId_personId: { competitionId, personId } },
    include: { roles: true },
  });
  if (!participant) throw AppError.notFound('Participation not found');

  await prisma.competitionParticipantRole.deleteMany({
    where: { competitionParticipantId: participant.id, role },
  });

  if (opts?.actorUserId) {
    await prisma.auditLog.create({
      data: {
        competitionId,
        userId: opts.actorUserId,
        action: 'COMPETITION_ROLE_REMOVED',
        entityType: 'CompetitionParticipant',
        entityId: participant.id,
        afterJson: { personId, role },
      },
    });
  }

  const remaining = await prisma.competitionParticipantRole.count({
    where: { competitionParticipantId: participant.id },
  });
  if (remaining === 0) {
    // Keep participant row for audit trail with withdrawn status
    await prisma.competitionParticipant.update({
      where: { id: participant.id },
      data: { status: 'WITHDRAWN' },
    });
  }

  return true;
}

export async function listCompetitionParticipants(competitionId: string) {
  await getCompetition(competitionId);
  return prisma.competitionParticipant.findMany({
    where: { competitionId },
    include: {
      person: { include: { nationalityCountry: true } },
      roles: true,
      pilot: { select: { id: true, pilotNumber: true, status: true } },
    },
    orderBy: { registrationDate: 'asc' },
  });
}

/** Map free-form official labels to CompetitionRole. */
export function mapOfficialLabelToRole(label: string): CompetitionRole {
  const r = label.trim().toLowerCase();
  if (r.includes('chief') && r.includes('judge')) return 'CHIEF_JUDGE';
  if (r.includes('target') && r.includes('judge')) return 'TARGET_JUDGE';
  if (r.includes('meet') && r.includes('director')) return 'MEET_DIRECTOR';
  if (r.includes('event') && r.includes('director')) return 'MEET_DIRECTOR';
  if (r.includes('score')) return 'SCORER';
  if (r.includes('announce')) return 'ANNOUNCER';
  if (r.includes('display')) return 'DISPLAY_OPERATOR';
  if (r.includes('launch')) return 'LAUNCH_MARSHAL';
  if (r.includes('goal')) return 'GOAL_MARSHAL';
  if (r.includes('registration')) return 'REGISTRATION_OFFICER';
  if (r.includes('safety')) return 'SAFETY_DIRECTOR';
  if (r.includes('technical')) return 'TECHNICAL_DELEGATE';
  if (r.includes('judge')) return 'JUDGE';
  if (r.includes('viewer')) return 'VIEWER';
  return 'OTHER';
}

export function competitionRoleToDisplayLabel(role: CompetitionRole): string {
  const map: Record<CompetitionRole, string> = {
    PILOT: 'Pilot',
    CHIEF_JUDGE: 'Chief Judge',
    TARGET_JUDGE: 'Target Judge',
    JUDGE: 'Judge',
    MEET_DIRECTOR: 'Meet Director',
    SCORER: 'Scorekeeper',
    ANNOUNCER: 'Announcer',
    DISPLAY_OPERATOR: 'Display Operator',
    LAUNCH_MARSHAL: 'Launch Marshal',
    GOAL_MARSHAL: 'Goal Marshal',
    REGISTRATION_OFFICER: 'Registration Officer',
    SAFETY_DIRECTOR: 'Safety Director',
    TECHNICAL_DELEGATE: 'Technical Delegate',
    VIEWER: 'Viewer',
    OTHER: 'Other',
  };
  return map[role] ?? role;
}
