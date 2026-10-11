import {
  SYSTEM_ORG_ROLE_DEFINITIONS,
  officialRoleLabel,
  officialRoleRank,
  type OrgRole,
} from '@aero-judge/shared';
import { prisma } from '../config/prisma.js';
import { competitionRoleToDisplayLabel } from './competition-participant.service.js';

/** Stored stamps that are not a real officiating title. */
const GENERIC_APPROVER_ROLES = new Set(['viewer', 'approver', 'user', 'member']);

export function isGenericApproverRole(label: string | null | undefined): boolean {
  const trimmed = label?.trim().toLowerCase() ?? '';
  return !trimmed || GENERIC_APPROVER_ROLES.has(trimmed);
}

/**
 * Prefer a real officiating title over a generic org fallback such as Viewer.
 * A specific stored title (Meet Director, Chief Judge) is kept.
 */
export function pickApproverRoleLabel(input: {
  storedLabel?: string | null;
  officialRoles?: string[];
  orgRoleLabel?: string | null;
}): string {
  const stored = input.storedLabel?.trim() ?? '';
  if (stored && !isGenericApproverRole(stored)) return stored;

  const officials = (input.officialRoles ?? [])
    .map((role) => officialRoleLabel(role))
    .filter((role) => role && !isGenericApproverRole(role))
    .sort((a, b) => officialRoleRank(a) - officialRoleRank(b) || a.localeCompare(b));
  if (officials.length > 0) return officials[0]!;

  const orgRole = input.orgRoleLabel?.trim() ?? '';
  if (orgRole) return orgRole;
  return stored || 'Approver';
}

/** Title shown for an organization membership, matching the admin sidebar. */
export function membershipRoleLabel(membership: {
  role: string;
  customRole?: { name?: string | null } | null;
}): string {
  const custom = membership.customRole?.name?.trim();
  if (custom) return custom;
  return (
    SYSTEM_ORG_ROLE_DEFINITIONS[membership.role as OrgRole]?.name ??
    membership.role.replace(/_/g, ' ')
  );
}

/** Role to print on an official results stamp for this approver. */
export async function resolveApproverRoleLabel(input: {
  competitionId: string;
  userId: string;
  storedLabel?: string | null;
}): Promise<string> {
  const stored = input.storedLabel?.trim() ?? '';
  if (stored && !isGenericApproverRole(stored)) return stored;

  const [user, competition] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { personId: true },
    }),
    prisma.competition.findUnique({
      where: { id: input.competitionId },
      select: { organizationId: true },
    }),
  ]);

  const officialRoles: string[] = [];
  if (user?.personId) {
    const [officials, participant] = await Promise.all([
      prisma.competitionOfficial.findMany({
        where: { competitionId: input.competitionId, personId: user.personId },
        select: { role: true },
      }),
      prisma.competitionParticipant.findUnique({
        where: {
          competitionId_personId: {
            competitionId: input.competitionId,
            personId: user.personId,
          },
        },
        select: { roles: { select: { role: true } } },
      }),
    ]);
    officialRoles.push(...officials.map((official) => official.role));
    officialRoles.push(
      ...(participant?.roles.map((row) => competitionRoleToDisplayLabel(row.role)) ?? []),
    );
  }

  let orgRoleLabel: string | null = null;
  if (competition?.organizationId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: competition.organizationId,
          userId: input.userId,
        },
      },
      select: { role: true, customRole: { select: { name: true } } },
    });
    if (membership) orgRoleLabel = membershipRoleLabel(membership);
  }

  return pickApproverRoleLabel({
    storedLabel: stored,
    officialRoles,
    orgRoleLabel,
  });
}
