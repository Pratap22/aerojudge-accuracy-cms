import { generateQrPayload, parseCsvLine, formatPilotName, toCsv } from '@npha/utils';
import { COMPETING_PILOT_STATUSES, type PilotStatus } from '@npha/shared';
import type { CompetitionParticipationStatus, Prisma } from '@npha/database';
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
      orderBy: { pilotNumber: 'asc' },
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

export async function createPilot(
  competitionId: string,
  data: CreatePilotInput,
  opts?: { actorUserId?: string },
) {
  await getCompetition(competitionId);
  const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
  const pilotNumber = Number(data.pilotNumber);
  if (!Number.isInteger(pilotNumber) || pilotNumber < 1) {
    throw AppError.badRequest('Pilot number must be a positive integer');
  }
  const qrCode = generateQrPayload(
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

  // Pilot numbers must be unique within the competition.
  const numberTaken = await prisma.pilot.findFirst({
    where: { competitionId, pilotNumber },
    select: { firstName: true, lastName: true, pilotNumber: true },
  });
  if (numberTaken) {
    throw AppError.conflict(
      `Pilot number ${pilotNumber} is already assigned to ${numberTaken.firstName} ${numberTaken.lastName}`,
    );
  }

  // QR payloads are globally unique. A stale QR (e.g. after renumbering without
  // updating the payload) can collide with a free number — repair it in-place.
  const qrTaken = await prisma.pilot.findFirst({
    where: { qrCode },
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
      throw AppError.conflict(
        `Pilot number ${pilotNumber} is already in use`,
      );
    }
  }

  // Organizer-added pilots default to CONFIRMED (ready to compete).
  // Public self-registration must pass status: 'REGISTERED' explicitly.
  const status = (pilotFields.status as PilotStatus | undefined) ?? 'CONFIRMED';

  let pilot;
  try {
    pilot = await prisma.pilot.create({
      data: {
        ...pilotFields,
        pilotNumber,
        firstName: snapshotFirstName,
        lastName: snapshotLastName,
        gender: pilotFields.gender ?? person.gender,
        civlId:
          (typeof pilotFields.civlId === 'string' ? pilotFields.civlId : null) ?? person.civlId,
        faiLicense:
          (typeof pilotFields.faiLicense === 'string' ? pilotFields.faiLicense : null) ??
          person.faiLicenseNumber,
        dateOfBirth: pilotFields.dateOfBirth ?? person.dateOfBirth ?? undefined,
        photoUrl:
          (typeof pilotFields.photoUrl === 'string' ? pilotFields.photoUrl : null) ?? person.photoUrl,
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

  const nextPilotNumber =
    typeof rest.pilotNumber === 'number' ? rest.pilotNumber : undefined;
  if (nextPilotNumber !== undefined && nextPilotNumber !== existing.pilotNumber) {
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
  return setPilotStatus(competitionId, pilotId, 'REJECTED');
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
      String(p.pilotNumber),
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
  const ambiguous: Array<{
    row: number;
    pilotNumber: number;
    matches: Awaited<ReturnType<typeof matchPersons>>;
  }> = [];
  const newPersons = 0;
  let reusedPersons = 0;
  let createdPersons = 0;
  const seenInFile = new Set<number>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.every((c) => !c)) continue;

    const pilotNumber = Number(col(cols, 'pilotnumber', 'number', 'pilotno') ?? cols[0]);
    const firstName = col(cols, 'firstname') ?? cols[1];
    const lastName = col(cols, 'lastname') ?? cols[2];
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
    const statusRaw = (col(cols, 'status') ?? 'CONFIRMED').toUpperCase();
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
        : 'CONFIRMED'
    ) as PilotStatus;

    if (!pilotNumber || !firstName || !lastName) {
      throw AppError.badRequest(`Invalid row ${i + 1}: pilotNumber, firstName, lastName required`);
    }

    if (existingNumbers.has(pilotNumber) || seenInFile.has(pilotNumber)) {
      skipped.push(pilotNumber);
      continue;
    }
    seenInFile.add(pilotNumber);

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
        pilotNumber,
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
      created.push(pilot);
      existingNumbers.add(pilotNumber);
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002'
      ) {
        const target = (err as { meta?: { target?: string[] } }).meta?.target ?? [];
        throw AppError.conflict(
          `Duplicate pilot data at row ${i + 1} (pilot #${pilotNumber}${
            target.length ? `; unique: ${target.join(', ')}` : ''
          }).`,
        );
      }
      throw err;
    }
  }

  return {
    imported: created.length,
    skipped: skipped.length,
    skippedNumbers: skipped,
    pilots: created,
    personMatching: {
      reusedPersons,
      createdPersons,
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
