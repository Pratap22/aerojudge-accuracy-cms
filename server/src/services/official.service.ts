import type { CreateOfficialInput, UpdateOfficialInput } from '@npha/shared';
import { compareOfficials, officialRoleRank } from '@npha/shared';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { uploadImageToCloudinary } from '../utils/cloudinary.js';
import {
  assignCompetitionRole,
  competitionRoleToDisplayLabel,
  getOrCreateParticipant,
  mapOfficialLabelToRole,
  removeCompetitionRole,
} from './competition-participant.service.js';
import { getCompetition } from './competition.service.js';
import {
  createPerson,
  getPerson,
  personDisplayName,
  resolvePersonPhotoUrl,
} from './person.service.js';

function mapOfficial(row: {
  id: string;
  competitionId: string;
  name: string;
  role: string;
  imageUrl: string | null;
  phone: string | null;
  email: string | null;
  displayOrder: number;
  isPublic: boolean;
  personId?: string | null;
  competitionRole?: string | null;
  person?: {
    id: string;
    aeroJudgeId: string;
    firstName: string;
    lastName: string;
  } | null;
}) {
  return {
    id: row.id,
    competitionId: row.competitionId,
    name: row.name,
    role: row.role,
    imageUrl: row.imageUrl,
    phone: row.phone,
    email: row.email,
    displayOrder: row.displayOrder,
    isPublic: row.isPublic,
    personId: row.personId ?? null,
    competitionRole: row.competitionRole ?? null,
    person: row.person
      ? {
          id: row.person.id,
          aeroJudgeId: row.person.aeroJudgeId,
          name: personDisplayName(row.person),
        }
      : null,
  };
}

export async function listOfficials(competitionId: string, opts?: { publicOnly?: boolean }) {
  await getCompetition(competitionId);
  const rows = await prisma.competitionOfficial.findMany({
    where: {
      competitionId,
      ...(opts?.publicOnly ? { isPublic: true } : {}),
    },
    include: {
      person: { select: { id: true, aeroJudgeId: true, firstName: true, lastName: true } },
    },
  });
  return rows.map(mapOfficial).sort(compareOfficials);
}

export async function getOfficial(competitionId: string, officialId: string) {
  const row = await prisma.competitionOfficial.findFirst({
    where: { id: officialId, competitionId },
    include: {
      person: { select: { id: true, aeroJudgeId: true, firstName: true, lastName: true } },
    },
  });
  if (!row) throw AppError.notFound('Official not found');
  return mapOfficial(row);
}

export async function createOfficial(
  competitionId: string,
  input: CreateOfficialInput,
  opts?: { actorUserId?: string },
) {
  await getCompetition(competitionId);
  const roleLabel = input.role.trim();
  const competitionRole = input.competitionRole ?? mapOfficialLabelToRole(roleLabel);

  let personId = input.personId;
  if (personId) {
    await getPerson(personId);
  } else {
    const name = (input.name ?? '').trim();
    const nameParts = name.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || '-';
    const person = await createPerson({
      firstName,
      lastName,
      email: input.email,
      phone: input.phone,
      photoUrl: input.imageUrl,
      forceCreate: true,
    }, { actorUserId: opts?.actorUserId });
    personId = person.id;
  }

  const person = await getPerson(personId);
  const displayName = (input.name?.trim() || personDisplayName(person)).trim();
  const profilePhotoUrl =
    input.imageUrl?.trim() ||
    (await resolvePersonPhotoUrl(personId, person.photoUrl));

  // Pilot ↔ judge/official same competition policy
  const participant = await getOrCreateParticipant(competitionId, personId);
  await assignCompetitionRole(competitionId, personId, competitionRole, {
    actorUserId: opts?.actorUserId,
  });
  const linked = await getOrCreateParticipant(competitionId, personId);

  const row = await prisma.competitionOfficial.create({
    data: {
      competitionId,
      personId,
      competitionParticipantId: linked.id,
      competitionRole,
      name: displayName,
      role: roleLabel || competitionRoleToDisplayLabel(competitionRole),
      phone: input.phone?.trim() || person.phone || null,
      email: input.email?.trim() || person.email || null,
      imageUrl: profilePhotoUrl,
      displayOrder: input.displayOrder ?? officialRoleRank(roleLabel) * 10,
      isPublic: input.isPublic ?? true,
    },
    include: {
      person: { select: { id: true, aeroJudgeId: true, firstName: true, lastName: true } },
    },
  });
  void participant;
  return mapOfficial(row);
}

export async function updateOfficial(
  competitionId: string,
  officialId: string,
  input: UpdateOfficialInput,
) {
  await getOfficial(competitionId, officialId);
  const row = await prisma.competitionOfficial.update({
    where: { id: officialId },
    data: {
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(input.role != null ? { role: input.role.trim() } : {}),
      ...(input.competitionRole != null ? { competitionRole: input.competitionRole } : {}),
      ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
      ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl?.trim() || null } : {}),
      ...(input.displayOrder != null ? { displayOrder: input.displayOrder } : {}),
      ...(input.isPublic != null ? { isPublic: input.isPublic } : {}),
    },
    include: {
      person: { select: { id: true, aeroJudgeId: true, firstName: true, lastName: true } },
    },
  });
  return mapOfficial(row);
}

export async function deleteOfficial(
  competitionId: string,
  officialId: string,
  opts?: { actorUserId?: string },
) {
  const official = await prisma.competitionOfficial.findFirst({
    where: { id: officialId, competitionId },
  });
  if (!official) throw AppError.notFound('Official not found');

  await prisma.competitionOfficial.delete({ where: { id: officialId } });

  if (official.personId && official.competitionRole) {
    try {
      await removeCompetitionRole(competitionId, official.personId, official.competitionRole, {
        actorUserId: opts?.actorUserId,
      });
    } catch {
      // keep Person and other roles
    }
  }
  return { deleted: true };
}

export async function uploadOfficialPhoto(
  competitionId: string,
  officialId: string,
  file: Express.Multer.File,
) {
  const existing = await getOfficial(competitionId, officialId);
  const { url } = await uploadImageToCloudinary(file, {
    folder: `officials/${competitionId}`,
    publicId: officialId,
  });
  const row = await prisma.competitionOfficial.update({
    where: { id: officialId },
    data: { imageUrl: url },
    include: {
      person: { select: { id: true, aeroJudgeId: true, firstName: true, lastName: true } },
    },
  });

  // Keep Person profile photo in sync (same pattern as pilot headshots).
  if (existing.personId) {
    await prisma.person.update({
      where: { id: existing.personId },
      data: { photoUrl: url },
    });
  }

  return mapOfficial(row);
}
