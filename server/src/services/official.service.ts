import type { CreateOfficialInput, UpdateOfficialInput } from '@aero-judge/shared';
import { compareOfficials, officialRoleLabel, officialRoleRank } from '@aero-judge/shared';
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
  displayedOfficialImageUrl,
  getPerson,
  personDisplayName,
  resolveMissingPersonPhotoUrls,
  resolvePersonPhotoUrl,
} from './person.service.js';

const officialPersonSelect = {
  id: true,
  aeroJudgeId: true,
  firstName: true,
  middleName: true,
  lastName: true,
  preferredName: true,
  displayName: true,
  photoUrl: true,
} as const;

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
    middleName?: string | null;
    lastName: string;
    preferredName?: string | null;
    displayName?: string | null;
    photoUrl?: string | null;
  } | null;
}) {
  const liveName = row.person ? personDisplayName(row.person) : '';
  return {
    id: row.id,
    competitionId: row.competitionId,
    // Prefer the linked Person so a directory rename shows without editing the
    // competition-time name snapshot by hand.
    name: liveName || row.name,
    role: officialRoleLabel(row.role),
    imageUrl: displayedOfficialImageUrl(row),
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

/** Keep every role row for this person on the same headshot. */
async function syncOfficialPhotosForPerson(personId: string, imageUrl: string): Promise<void> {
  await prisma.$transaction([
    prisma.person.update({
      where: { id: personId },
      data: { photoUrl: imageUrl },
    }),
    prisma.competitionOfficial.updateMany({
      where: { personId },
      data: { imageUrl },
    }),
  ]);
}

export async function listOfficials(competitionId: string, opts?: { publicOnly?: boolean }) {
  await getCompetition(competitionId);
  const rows = await prisma.competitionOfficial.findMany({
    where: {
      competitionId,
      ...(opts?.publicOnly ? { isPublic: true } : {}),
    },
    include: {
      person: { select: officialPersonSelect },
    },
  });

  // Share one headshot across every role for the same person (and backfill Person.photoUrl).
  const linkedPeople = rows
    .filter((row) => row.personId && row.person)
    .map((row) => ({ id: row.personId!, photoUrl: row.person!.photoUrl }));
  const uniquePeople = [...new Map(linkedPeople.map((p) => [p.id, p])).values()];
  const photoByPerson = await resolveMissingPersonPhotoUrls(uniquePeople);

  return rows
    .map((row) => {
      if (!row.personId || !row.person) return mapOfficial(row);
      const sharedPhoto = photoByPerson.get(row.personId) ?? row.person.photoUrl;
      return mapOfficial({
        ...row,
        person: { ...row.person, photoUrl: sharedPhoto },
      });
    })
    .sort(compareOfficials);
}

export async function getOfficial(competitionId: string, officialId: string) {
  const row = await prisma.competitionOfficial.findFirst({
    where: { id: officialId, competitionId },
    include: {
      person: { select: officialPersonSelect },
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
      gender: input.gender,
      civlId: input.civlId,
      faiLicenseNumber: input.faiLicenseNumber,
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
      person: { select: officialPersonSelect },
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
  const existing = await prisma.competitionOfficial.findFirst({
    where: { id: officialId, competitionId },
    select: { id: true, personId: true },
  });
  if (!existing) throw AppError.notFound('Official not found');

  const nextName = input.name?.trim();
  if (nextName && existing.personId) {
    const parts = nextName.split(/\s+/).filter(Boolean);
    await prisma.person.update({
      where: { id: existing.personId },
      data: {
        firstName: parts[0] || 'Unknown',
        lastName: parts.slice(1).join(' ') || '-',
      },
    });
  }

  const nextImageUrl =
    input.imageUrl !== undefined ? input.imageUrl?.trim() || null : undefined;

  const row = await prisma.competitionOfficial.update({
    where: { id: officialId },
    data: {
      ...(nextName != null ? { name: nextName } : {}),
      ...(input.role != null ? { role: input.role.trim() } : {}),
      ...(input.competitionRole != null ? { competitionRole: input.competitionRole } : {}),
      ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
      ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
      ...(nextImageUrl !== undefined ? { imageUrl: nextImageUrl } : {}),
      ...(input.displayOrder != null ? { displayOrder: input.displayOrder } : {}),
      ...(input.isPublic != null ? { isPublic: input.isPublic } : {}),
    },
    include: {
      person: { select: officialPersonSelect },
    },
  });

  if (nextImageUrl && existing.personId) {
    await syncOfficialPhotosForPerson(existing.personId, nextImageUrl);
    return getOfficial(competitionId, officialId);
  }

  return mapOfficial(row);
}

/**
 * Keep competition-time official name snapshots aligned with the Person
 * directory after a rename.
 */
export async function syncOfficialNamesForPerson(personId: string): Promise<number> {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: {
      firstName: true,
      middleName: true,
      lastName: true,
      preferredName: true,
      displayName: true,
    },
  });
  if (!person) return 0;
  const name = personDisplayName(person);
  if (!name) return 0;
  const result = await prisma.competitionOfficial.updateMany({
    where: { personId },
    data: { name },
  });
  return result.count;
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
    publicId: existing.personId ?? officialId,
  });

  if (existing.personId) {
    // One photo for the person — every role row (Safety Director, Launch Marshal, …) shares it.
    await syncOfficialPhotosForPerson(existing.personId, url);
  } else {
    await prisma.competitionOfficial.update({
      where: { id: officialId },
      data: { imageUrl: url },
    });
  }

  return getOfficial(competitionId, officialId);
}
