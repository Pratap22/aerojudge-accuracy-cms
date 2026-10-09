import { generateQrPayload, parseCsvLine, formatPilotName, toCsv } from '@aero-judge/utils';
import { COMPETING_PILOT_STATUSES, STARTED_ROUND_STATUSES, type PilotStatus } from '@aero-judge/shared';
import type { CompetitionParticipationStatus, Prisma } from '@aero-judge/database';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { resolveCountryId } from '../utils/country-resolve.js';
import {
  assertPilotJudgePolicy,
  assignCompetitionRole,
  getOrCreateParticipant,
} from './competition-participant.service.js';
import { getCompetition } from './competition.service.js';
import {
  createPerson,
  displayedPilotPhotoUrl,
  getPerson,
  matchPersons,
  personDisplayName,
  resolvePersonPhotoUrl,
  updatePerson,
  type CreatePersonInput,
} from './person.service.js';

/** Statuses that may appear on flight orders and scoring lists. */
export const ELIGIBLE_PILOT_STATUSES: PilotStatus[] = [...COMPETING_PILOT_STATUSES];

function mapParticipantStatus(status: PilotStatus): CompetitionParticipationStatus {
  switch (status) {
    case 'REGISTERED':
      return 'REGISTERED';
    case 'CONFIRMED':
      return 'CONFIRMED';
    case 'CHECKED_IN':
    case 'ACTIVE':
      return 'ACTIVE';
    case 'REJECTED':
      return 'DECLINED';
    case 'WITHDRAWN':
    case 'DISQUALIFIED':
    case 'DNS':
      return 'WITHDRAWN';
    default:
      return 'REGISTERED';
  }
}

async function syncParticipantStatus(
  competitionId: string,
  personId: string | null | undefined,
  pilotStatus: PilotStatus,
): Promise<void> {
  if (!personId) return;
  await prisma.competitionParticipant.updateMany({
    where: { competitionId, personId },
    data: { status: mapParticipantStatus(pilotStatus) },
  });
}

export async function listPilots(
  competitionId: string,
  query: { page: number; pageSize: number; search?: string; status?: PilotStatus },
) {
  await getCompetition(competitionId);
  const where: Prisma.PilotWhereInput = { competitionId };
  if (query.status) {
    where.status = query.status;
  }
  if (query.search) {
    where.OR = [
      { firstName: { contains: query.search, mode: 'insensitive' } },
      { lastName: { contains: query.search, mode: 'insensitive' } },
      { faiLicense: { contains: query.search, mode: 'insensitive' } },
      { civlId: { contains: query.search, mode: 'insensitive' } },
      { person: { aeroJudgeId: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.pilot.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { pilotNumber: { sort: 'asc', nulls: 'first' } },
      include: {
        country: true,
        person: { select: { id: true, aeroJudgeId: true, civlId: true, photoUrl: true } },
      },
    }),
    prisma.pilot.count({ where }),
  ]);

  return {
    items: items.map((pilot) => ({
      ...pilot,
      photoUrl: displayedPilotPhotoUrl(pilot),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getPilot(competitionId: string, pilotId: string) {
  const pilot = await prisma.pilot.findFirst({
    where: { id: pilotId, competitionId },
    include: {
      country: true,
      teamMembers: { include: { team: true } },
      person: { select: { id: true, aeroJudgeId: true, civlId: true, photoUrl: true } },
    },
  });
  if (!pilot) throw AppError.notFound('Pilot not found');
  return {
    ...pilot,
    photoUrl: displayedPilotPhotoUrl(pilot),
  };
}

export type CreatePilotInput = Omit<Prisma.PilotUncheckedCreateInput, 'competitionId'> & {
  /** Reuse an existing Person (returning participant). */
  personId?: string;
};

/**
 * Store a CIVL ID or FAI license on the person only when that field is still empty.
 * Existing directory values are left unchanged.
 */
async function fillMissingPersonIds(
  personId: string,
  person: { civlId?: string | null; faiLicenseNumber?: string | null },
  civlId: string,
  faiLicense: string,
  actorUserId?: string,
): Promise<void> {
  const patch: Partial<CreatePersonInput> = {};
  if (!person.civlId?.trim() && civlId) patch.civlId = civlId;
  if (!person.faiLicenseNumber?.trim() && faiLicense) patch.faiLicenseNumber = faiLicense;
  if (Object.keys(patch).length === 0) return;
  await updatePerson(personId, patch, { actorUserId });
}

async function roundHasStarted(competitionId: string): Promise<boolean> {
  const started = await prisma.round.findFirst({
    where: { competitionId, status: { in: [...STARTED_ROUND_STATUSES] } },
    select: { id: true },
  });
  return started != null;
}

async function assertCanAddPilots(competitionId: string): Promise<void> {
  if (await roundHasStarted(competitionId)) {
    throw AppError.badRequest('Pilots cannot be added after a round has started.');
  }
}

export async function createPilot(
  competitionId: string,
  data: CreatePilotInput,
  opts?: { actorUserId?: string },
) {
  await getCompetition(competitionId);
  await assertCanAddPilots(competitionId);
  const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
  const pilotNumber =
    data.pilotNumber == null || Number.isNaN(Number(data.pilotNumber))
      ? null
      : Number(data.pilotNumber);
  if (pilotNumber != null && (!Number.isInteger(pilotNumber) || pilotNumber < 1)) {
    throw AppError.badRequest('Pilot number must be a positive integer');
  }
  const qrCode =
    pilotNumber == null
      ? null
      : generateQrPayload(
          env.PUBLIC_RESULTS_URL,
          competition!.publicSlug,
          `/pilot/${pilotNumber}`,
        );

  const countryId =
    (typeof data.countryId === 'string' && data.countryId) ||
    (await resolveCountryId(
      typeof data.nationality === 'string' ? data.nationality : undefined,
    )) ||
    undefined;

  const { personId: requestedPersonId, ...pilotFields } = data;

  let personId = requestedPersonId;
  if (personId) {
    await getPerson(personId);
  } else {
    // Prefer exact CIVL match over creating a duplicate Person.
    const civlId =
      typeof pilotFields.civlId === 'string' ? pilotFields.civlId.trim() : undefined;
    if (civlId) {
      const matches = await matchPersons({ civlId });
      const exact = matches.find((m) => m.confidence === 'EXACT' && m.reason === 'civlId');
      if (exact) personId = exact.person.id;
    }
    if (!personId) {
      const personInput: CreatePersonInput = {
        firstName: String(pilotFields.firstName),
        lastName: String(pilotFields.lastName),
        gender: (pilotFields.gender as CreatePersonInput['gender']) ?? 'MALE',
        civlId: typeof pilotFields.civlId === 'string' ? pilotFields.civlId : null,
        faiLicenseNumber:
          typeof pilotFields.faiLicense === 'string' ? pilotFields.faiLicense : null,
        dateOfBirth: pilotFields.dateOfBirth as Date | string | null | undefined,
        nationalityCountryId: countryId ?? null,
        nationality: typeof pilotFields.nationality === 'string' ? pilotFields.nationality : null,
        photoUrl: typeof pilotFields.photoUrl === 'string' ? pilotFields.photoUrl : null,
        forceCreate: true,
      };
      const person = await createPerson(personInput, { actorUserId: opts?.actorUserId });
      personId = person.id;
    }
  }

  // Snapshot identity from Person when reusing directory identity.
  const person = await getPerson(personId);
  const submittedCivl =
    typeof pilotFields.civlId === 'string' ? pilotFields.civlId.trim() : '';
  const submittedFai =
    typeof pilotFields.faiLicense === 'string' ? pilotFields.faiLicense.trim() : '';
  await fillMissingPersonIds(personId, person, submittedCivl, submittedFai, opts?.actorUserId);
  const snapshotFirstName =
    typeof pilotFields.firstName === 'string' && pilotFields.firstName.trim()
      ? pilotFields.firstName
      : person.firstName;
  const snapshotLastName =
    typeof pilotFields.lastName === 'string' && pilotFields.lastName.trim()
      ? pilotFields.lastName
      : person.lastName;

  // Policy + enrollment
  const participant = await getOrCreateParticipant(competitionId, personId);
  assertPilotJudgePolicy(
    participant.roles.map((r) => r.role),
    'PILOT',
  );
  await assignCompetitionRole(competitionId, personId, 'PILOT', {
    actorUserId: opts?.actorUserId,
  });
  const linkedParticipant = await getOrCreateParticipant(competitionId, personId);

  // Already enrolled as pilot?
  const existingPilot = await prisma.pilot.findFirst({
    where: { competitionId, personId },
  });
  if (existingPilot) {
    throw AppError.conflict(
      `${personDisplayName(person)} is already registered as pilot #${existingPilot.pilotNumber}`,
    );
  }

  if (pilotNumber != null) {
    const numberTaken = await prisma.pilot.findFirst({
      where: { competitionId, pilotNumber },
      select: { firstName: true, lastName: true, pilotNumber: true },
    });
    if (numberTaken) {
      throw AppError.conflict(
        `Pilot number ${pilotNumber} is already assigned to ${numberTaken.firstName} ${numberTaken.lastName}`,
      );
    }

    const qrTaken = await prisma.pilot.findFirst({
      where: { qrCode: qrCode! },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        pilotNumber: true,
        competitionId: true,
      },
    });
    if (qrTaken) {
      if (qrTaken.competitionId === competitionId && qrTaken.pilotNumber !== pilotNumber) {
        const repairedQr = generateQrPayload(
          env.PUBLIC_RESULTS_URL,
          competition!.publicSlug,
          `/pilot/${qrTaken.pilotNumber}`,
        );
        await prisma.pilot.update({
          where: { id: qrTaken.id },
          data: { qrCode: repairedQr },
        });
      } else {
        throw AppError.conflict(`Pilot number ${pilotNumber} is already in use`);
      }
    }
  }

  // Organizer-added pilots default to CONFIRMED (ready to compete).
  // Public self-registration must pass status: 'REGISTERED' explicitly.
  const status = (pilotFields.status as PilotStatus | undefined) ?? 'CONFIRMED';
  const profilePhotoUrl =
    (typeof pilotFields.photoUrl === 'string' ? pilotFields.photoUrl : null) ??
    (await resolvePersonPhotoUrl(personId, person.photoUrl));

  let pilot;
  try {
    pilot = await prisma.pilot.create({
      data: {
        ...pilotFields,
        pilotNumber: pilotNumber ?? null,
        firstName: snapshotFirstName,
        lastName: snapshotLastName,
        gender: pilotFields.gender ?? person.gender,
        civlId: person.civlId?.trim() || submittedCivl || null,
        faiLicense: person.faiLicenseNumber?.trim() || submittedFai || null,
        dateOfBirth: pilotFields.dateOfBirth ?? person.dateOfBirth ?? undefined,
        photoUrl: profilePhotoUrl,
        competitionId,
        personId,
        competitionParticipantId: linkedParticipant.id,
        qrCode,
        countryId: countryId ?? person.nationalityCountryId ?? undefined,
        isWomen:
          pilotFields.gender === 'FEMALE' ||
          pilotFields.isWomen === true ||
          person.gender === 'FEMALE',
        status,
      },
      include: {
        country: true,
        person: { select: { id: true, aeroJudgeId: true, civlId: true } },
      },
    });
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      const target = (err as { meta?: { target?: string | string[] } }).meta?.target;
      const fields = Array.isArray(target) ? target : target ? [target] : [];
      if (
        fields.some(
          (f) =>
            f === 'qrCode' ||
            f.includes('qrCode') ||
            f.includes('pilotNumber') ||
            f.includes('competitionId_pilotNumber'),
        )
      ) {
        throw AppError.conflict(
          `Pilot number ${pilotNumber} is already in use in this competition`,
        );
      }
    }
    throw err;
  }

  await syncParticipantStatus(competitionId, personId, status);
  return pilot;
}

export async function updatePilot(
  competitionId: string,
  pilotId: string,
  data: Omit<Prisma.PilotUncheckedUpdateInput, 'id' | 'competitionId'>,
) {
  const existing = await getPilot(competitionId, pilotId);
  const { gender, nationality, countryId, status, ...rest } = data;

  let nextCountryId = countryId;
  if (nextCountryId === undefined && typeof nationality === 'string') {
    nextCountryId = (await resolveCountryId(nationality)) ?? undefined;
  }

  if (status !== undefined && status !== null) {
    await setPilotStatus(competitionId, pilotId, status as PilotStatus);
  }

  const submittedCivl = typeof rest.civlId === 'string' ? rest.civlId.trim() : '';
  const submittedFai = typeof rest.faiLicense === 'string' ? rest.faiLicense.trim() : '';
  if (existing.civlId?.trim()) delete rest.civlId;
  if (existing.faiLicense?.trim()) delete rest.faiLicense;
  if (existing.personId && (!existing.civlId?.trim() || !existing.faiLicense?.trim())) {
    const person = await getPerson(existing.personId);
    await fillMissingPersonIds(
      existing.personId,
      person,
      existing.civlId?.trim() ? '' : submittedCivl,
      existing.faiLicense?.trim() ? '' : submittedFai,
    );
  }

  const clearingNumber = rest.pilotNumber === null;
  const nextPilotNumber =
    typeof rest.pilotNumber === 'number' ? rest.pilotNumber : undefined;
  const numberChanged =
    clearingNumber ||
    (nextPilotNumber !== undefined && nextPilotNumber !== existing.pilotNumber);
  if (numberChanged && (await roundHasStarted(competitionId))) {
    throw AppError.badRequest('Pilot numbers cannot be changed after a round has started.');
  }
  if (clearingNumber) {
    rest.qrCode = null;
  } else if (nextPilotNumber !== undefined && nextPilotNumber !== existing.pilotNumber) {
    const numberTaken = await prisma.pilot.findFirst({
      where: {
        competitionId,
        pilotNumber: nextPilotNumber,
        NOT: { id: pilotId },
      },
      select: { firstName: true, lastName: true, pilotNumber: true },
    });
    if (numberTaken) {
      throw AppError.conflict(
        `Pilot number ${nextPilotNumber} is already assigned to ${numberTaken.firstName} ${numberTaken.lastName}`,
      );
    }
    const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
    const nextQr = generateQrPayload(
      env.PUBLIC_RESULTS_URL,
      competition!.publicSlug,
      `/pilot/${nextPilotNumber}`,
    );
    const qrTaken = await prisma.pilot.findFirst({
      where: { qrCode: nextQr, NOT: { id: pilotId } },
      select: { id: true, pilotNumber: true, competitionId: true },
    });
    if (qrTaken) {
      if (qrTaken.competitionId === competitionId && qrTaken.pilotNumber !== nextPilotNumber) {
        await prisma.pilot.update({
          where: { id: qrTaken.id },
          data: {
            qrCode: generateQrPayload(
              env.PUBLIC_RESULTS_URL,
              competition!.publicSlug,
              `/pilot/${qrTaken.pilotNumber}`,
            ),
          },
        });
      } else {
        throw AppError.conflict(`Pilot number ${nextPilotNumber} is already in use`);
      }
    }
    rest.qrCode = nextQr;
  }

  return prisma.pilot.update({
    where: { id: pilotId },
    data: {
      ...rest,
      ...(nationality !== undefined ? { nationality } : {}),
      ...(nextCountryId !== undefined ? { countryId: nextCountryId } : {}),
      ...(gender !== undefined ? { gender, isWomen: gender === 'FEMALE' } : {}),
    },
    include: {
      country: true,
      person: { select: { id: true, aeroJudgeId: true, civlId: true } },
    },
  });
}

/**
 * Accept, reject, check-in, withdraw, etc.
 */
export async function setPilotStatus(
  competitionId: string,
  pilotId: string,
  status: PilotStatus,
) {
  const pilot = await getPilot(competitionId, pilotId);
  if (pilot.status === status) {
    return pilot;
  }

  const updated = await prisma.pilot.update({
    where: { id: pilotId },
    data: { status },
    include: {
      country: true,
      person: { select: { id: true, aeroJudgeId: true, civlId: true } },
    },
  });

  await syncParticipantStatus(competitionId, updated.personId, status);
  return updated;
}

export async function acceptPilot(competitionId: string, pilotId: string) {
  return setPilotStatus(competitionId, pilotId, 'CONFIRMED');
}

export async function rejectPilot(competitionId: string, pilotId: string) {
  const updated = await setPilotStatus(competitionId, pilotId, 'REJECTED');
  await dropUnscoredFlights(competitionId, [pilotId]);
  return updated;
}

const ACCEPTABLE_STATUSES = new Set<PilotStatus>(['REGISTERED', 'REJECTED']);
const REJECTABLE_STATUSES = new Set<PilotStatus>(['REGISTERED', 'CONFIRMED']);

/**
 * Drop a pilot from flight orders that are still editable when they have no score.
 * Approved and locked rounds keep their flights.
 */
async function dropUnscoredFlights(competitionId: string, pilotIds: string[]): Promise<void> {
  if (!pilotIds.length) return;
  await prisma.flight.deleteMany({
    where: {
      pilotId: { in: pilotIds },
      scores: { none: {} },
      round: { competitionId, status: { notIn: ['APPROVED', 'LOCKED'] } },
    },
  });
}

export interface BulkPilotSkip {
  pilotId: string;
  name: string;
  reason: string;
}

/**
 * Accept, reject, or remove many pilots in one competition.
 * Reject also removes unscored flights so they leave an open flight order.
 * Remove refuses pilots who already have scores.
 */
export async function bulkPilotAction(
  competitionId: string,
  action: 'accept' | 'reject' | 'remove',
  pilotIds: string[],
  opts?: { actorUserId?: string },
): Promise<{
  action: 'accept' | 'reject' | 'remove';
  succeeded: string[];
  skipped: BulkPilotSkip[];
}> {
  await getCompetition(competitionId);
  const uniqueIds = [...new Set(pilotIds)];
  const pilots = await prisma.pilot.findMany({
    where: { competitionId, id: { in: uniqueIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      personId: true,
      _count: { select: { scores: true } },
    },
  });
  const byId = new Map(pilots.map((pilot) => [pilot.id, pilot]));
  const succeeded: string[] = [];
  const skipped: BulkPilotSkip[] = [];
  const eligible: typeof pilots = [];

  for (const id of uniqueIds) {
    const pilot = byId.get(id);
    const name = pilot ? `${pilot.firstName} ${pilot.lastName}` : 'Unknown pilot';
    if (!pilot) {
      skipped.push({ pilotId: id, name, reason: 'Not in this competition' });
      continue;
    }
    if (action === 'accept' && !ACCEPTABLE_STATUSES.has(pilot.status)) {
      skipped.push({
        pilotId: id,
        name,
        reason:
          pilot.status === 'CONFIRMED' || pilot.status === 'CHECKED_IN' || pilot.status === 'ACTIVE'
            ? 'Already accepted'
            : 'Cannot accept this status',
      });
      continue;
    }
    if (action === 'reject' && !REJECTABLE_STATUSES.has(pilot.status)) {
      skipped.push({
        pilotId: id,
        name,
        reason: pilot.status === 'REJECTED' ? 'Already rejected' : 'Cannot reject this status',
      });
      continue;
    }
    if (action === 'remove' && pilot._count.scores > 0) {
      skipped.push({
        pilotId: id,
        name,
        reason: 'Already has scores — reject them instead of removing',
      });
      continue;
    }
    eligible.push(pilot);
  }

  if (action === 'remove') {
    for (const pilot of eligible) {
      await deletePilot(competitionId, pilot.id, opts);
      succeeded.push(pilot.id);
    }
    return { action, succeeded, skipped };
  }

  if (!eligible.length) return { action, succeeded, skipped };

  const nextStatus: PilotStatus = action === 'accept' ? 'CONFIRMED' : 'REJECTED';
  await prisma.pilot.updateMany({
    where: { id: { in: eligible.map((pilot) => pilot.id) } },
    data: { status: nextStatus },
  });
  for (const pilot of eligible) {
    await syncParticipantStatus(competitionId, pilot.personId, nextStatus);
    succeeded.push(pilot.id);
  }
  if (action === 'reject') {
    await dropUnscoredFlights(
      competitionId,
      eligible.map((pilot) => pilot.id),
    );
  }

  return { action, succeeded, skipped };
}

/**
 * Upload pilot headshot (Cloudinary). Writes Person.photoUrl (SSoT) and syncs
 * every competition Pilot row for that person so all boards stay consistent.
 */
export async function uploadPilotPhoto(
  competitionId: string,
  pilotId: string,
  file: Express.Multer.File,
) {
  const pilot = await getPilot(competitionId, pilotId);
  const { uploadImageToCloudinary } = await import('../utils/cloudinary.js');
  const { url } = await uploadImageToCloudinary(file, {
    folder: `pilots/${competitionId}`,
    publicId: pilotId,
  });

  if (pilot.personId) {
    await prisma.$transaction([
      prisma.person.update({
        where: { id: pilot.personId },
        data: { photoUrl: url },
      }),
      prisma.pilot.updateMany({
        where: { personId: pilot.personId },
        data: { photoUrl: url },
      }),
    ]);
  } else {
    await prisma.pilot.update({
      where: { id: pilotId },
      data: { photoUrl: url },
    });
  }

  return getPilot(competitionId, pilotId);
}

/** Clear pilot headshot. Clears Person SSoT when linked, and all of that person's pilot rows. */
export async function removePilotPhoto(competitionId: string, pilotId: string) {
  const pilot = await getPilot(competitionId, pilotId);

  if (pilot.personId) {
    await prisma.$transaction([
      prisma.person.update({
        where: { id: pilot.personId },
        data: { photoUrl: null },
      }),
      prisma.pilot.updateMany({
        where: { personId: pilot.personId },
        data: { photoUrl: null },
      }),
    ]);
  } else {
    await prisma.pilot.update({
      where: { id: pilotId },
      data: { photoUrl: null },
    });
  }

  return getPilot(competitionId, pilotId);
}

export async function deletePilot(
  competitionId: string,
  pilotId: string,
  opts?: { actorUserId?: string },
): Promise<void> {
  const pilot = await getPilot(competitionId, pilotId);
  const personId = pilot.personId;

  await prisma.pilot.delete({ where: { id: pilotId } });

  if (personId) {
    const { removeCompetitionRole } = await import('./competition-participant.service.js');
    try {
      await removeCompetitionRole(competitionId, personId, 'PILOT', {
        actorUserId: opts?.actorUserId,
      });
    } catch {
      // Role may already be absent
    }
  }
}

export async function searchPilots(competitionId: string, q: string, limit = 20) {
  await getCompetition(competitionId);
  return prisma.pilot.findMany({
    where: {
      competitionId,
      status: { in: [...ELIGIBLE_PILOT_STATUSES] },
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { pilotNumber: { equals: Number.isFinite(Number(q)) ? Number(q) : -1 } },
      ],
    },
    take: limit,
    orderBy: { pilotNumber: 'asc' },
    include: { country: true },
  });
}

export async function getPilotByQr(competitionId: string, qrCode: string) {
  const pilot = await prisma.pilot.findFirst({
    where: { competitionId, OR: [{ qrCode }, { barcode: qrCode }] },
    include: { country: true },
  });
  if (!pilot) throw AppError.notFound('Pilot not found for QR code');
  return pilot;
}

export async function exportPilotsCsv(competitionId: string): Promise<string> {
  await getCompetition(competitionId);
  const pilots = await prisma.pilot.findMany({
    where: { competitionId },
    orderBy: { pilotNumber: 'asc' },
  });

  const rows: string[][] = [
    [
      'pilotNumber',
      'firstName',
      'lastName',
      'gender',
      'nationality',
      'club',
      'glider',
      'civlId',
      'notes',
      'faiLicense',
      'status',
    ],
    ...pilots.map((p) => [
      p.pilotNumber == null ? '' : String(p.pilotNumber),
      p.firstName,
      p.lastName,
      p.gender,
      p.nationality ?? '',
      p.club ?? '',
      p.glider ?? '',
      p.civlId ?? '',
      p.notes ?? '',
      p.faiLicense ?? '',
      p.status,
    ]),
  ];

  return toCsv(rows);
}

export async function importPilotsFromCsv(competitionId: string, csvContent: string) {
  await getCompetition(competitionId);
  await assertCanAddPilots(competitionId);
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw AppError.badRequest('CSV must include header and at least one row');

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[\s_]+/g, ''));
  const colIndex = (name: string): number => header.indexOf(name);
  const col = (cols: string[], ...names: string[]): string | undefined => {
    for (const name of names) {
      const idx = colIndex(name);
      if (idx >= 0 && cols[idx]?.trim()) return cols[idx].trim();
    }
    return undefined;
  };

  const existing = await prisma.pilot.findMany({
    where: { competitionId },
    select: { pilotNumber: true },
  });
  const existingNumbers = new Set(existing.map((p) => p.pilotNumber));

  const created = [];
  const skipped: number[] = [];
  let pending = 0;
  const ambiguous: Array<{
    row: number;
    pilotNumber: number | null;
    matches: Awaited<ReturnType<typeof matchPersons>>;
  }> = [];
  const newPersons = 0;
  let reusedPersons = 0;
  let createdPersons = 0;
  let alreadyRegistered = 0;
  const seenInFile = new Set<number>();
  const hasNumberColumn = ['pilotnumber', 'number', 'pilotno'].some((name) => colIndex(name) >= 0);

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.every((c) => !c)) continue;

    const rawNumber = col(cols, 'pilotnumber', 'number', 'pilotno');
    const parsedNumber = rawNumber
      ? Number(rawNumber)
      : !hasNumberColumn && Number.isInteger(Number(cols[0]))
        ? Number(cols[0])
        : null;
    const pilotNumber =
      parsedNumber != null && Number.isInteger(parsedNumber) && parsedNumber >= 1
        ? parsedNumber
        : null;
    if (rawNumber && pilotNumber == null) {
      throw AppError.badRequest(`Invalid pilot number at row ${i + 1}`);
    }
    const firstName = col(cols, 'firstname') ?? (pilotNumber == null ? cols[0] : cols[1]);
    const lastName = col(cols, 'lastname') ?? (pilotNumber == null ? cols[1] : cols[2]);
    const genderRaw = (col(cols, 'gender') ?? 'MALE').toUpperCase();
    const gender = (['MALE', 'FEMALE', 'OTHER'].includes(genderRaw) ? genderRaw : 'MALE') as
      | 'MALE'
      | 'FEMALE'
      | 'OTHER';
    const nationality = col(cols, 'nationality', 'country');
    const faiLicense = col(cols, 'failicense', 'fai');
    const civlId = col(cols, 'civlid', 'civilid');
    const aeroJudgeId = col(cols, 'aerojudgeid', 'ajid');
    const club = col(cols, 'club', 'team');
    const glider = col(cols, 'glider');
    const notes = col(cols, 'notes', 'serialno', 'serial');
    // Spreadsheet imports (CIVL entry lists) stay pending unless the file sets a status.
    const statusRaw = (col(cols, 'status') ?? 'REGISTERED').toUpperCase();
    const status = (
      [
        'REGISTERED',
        'CONFIRMED',
        'CHECKED_IN',
        'ACTIVE',
        'REJECTED',
        'WITHDRAWN',
        'DISQUALIFIED',
        'DNS',
      ].includes(statusRaw)
        ? statusRaw
        : 'REGISTERED'
    ) as PilotStatus;

    if (!firstName || !lastName) {
      throw AppError.badRequest(`Invalid row ${i + 1}: firstName and lastName are required`);
    }

    if (pilotNumber != null && (existingNumbers.has(pilotNumber) || seenInFile.has(pilotNumber))) {
      skipped.push(pilotNumber);
      continue;
    }
    if (pilotNumber != null) seenInFile.add(pilotNumber);

    const matches = await matchPersons({
      aeroJudgeId,
      civlId,
      faiLicenseNumber: faiLicense,
      firstName,
      lastName,
    });
    const exact = matches.filter((m) => m.confidence === 'EXACT');
    const possible = matches.filter((m) => m.confidence === 'POSSIBLE');

    if (exact.length > 1 || (exact.length === 0 && possible.length > 1 && !civlId && !aeroJudgeId)) {
      ambiguous.push({ row: i + 1, pilotNumber, matches });
      continue;
    }

    const personId = exact[0]?.person.id;

    try {
      const pilot = await createPilot(competitionId, {
        ...(pilotNumber != null ? { pilotNumber } : {}),
        firstName,
        lastName,
        gender,
        nationality,
        faiLicense,
        civlId,
        club,
        glider,
        notes,
        isWomen: gender === 'FEMALE',
        personId,
        status,
      });
      if (personId) reusedPersons += 1;
      else createdPersons += 1;
      if (pilot.status === 'REGISTERED') pending += 1;
      created.push(pilot);
      if (pilot.pilotNumber != null) existingNumbers.add(pilot.pilotNumber);
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 409) {
        alreadyRegistered += 1;
        continue;
      }
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002'
      ) {
        const target = (err as { meta?: { target?: string[] } }).meta?.target ?? [];
        throw AppError.conflict(
          `Duplicate pilot data at row ${i + 1}${
            pilotNumber != null ? ` (pilot #${pilotNumber})` : ''
          }${target.length ? `; unique: ${target.join(', ')}` : ''}.`,
        );
      }
      throw err;
    }
  }

  return {
    imported: created.length,
    pending,
    skipped: skipped.length,
    skippedNumbers: skipped,
    pilots: created,
    personMatching: {
      reusedPersons,
      createdPersons,
      alreadyRegistered,
      ambiguousCount: ambiguous.length,
      ambiguous,
    },
    newPersons,
  };
}

export function formatPilotDisplay(pilot: {
  pilotNumber: number;
  firstName: string;
  lastName: string;
  country?: { name: string } | null;
  nationality?: string | null;
}) {
  return {
    pilotNumber: pilot.pilotNumber,
    name: formatPilotName(pilot.firstName, pilot.lastName),
    country: pilot.country?.name ?? pilot.nationality ?? undefined,
  };
}
