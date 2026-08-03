import { generateQrPayload, parseCsvLine, formatPilotName, toCsv } from '@npha/utils';
import type { Prisma } from '@npha/database';
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
  getPerson,
  matchPersons,
  personDisplayName,
  type CreatePersonInput,
} from './person.service.js';

export async function listPilots(
  competitionId: string,
  query: { page: number; pageSize: number; search?: string },
) {
  await getCompetition(competitionId);
  const where: Prisma.PilotWhereInput = { competitionId };
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
        person: { select: { id: true, aeroJudgeId: true, civlId: true } },
      },
    }),
    prisma.pilot.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
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
  return pilot;
}

export type CreatePilotInput = Omit<Prisma.PilotUncheckedCreateInput, 'competitionId'> & {
  /** Reuse an existing Person (returning participant). */
  personId?: string;
};

export async function createPilot(competitionId: string, data: CreatePilotInput) {
  await getCompetition(competitionId);
  const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
  const qrCode = generateQrPayload(
    env.PUBLIC_RESULTS_URL,
    competition!.publicSlug,
    `/pilot/${data.pilotNumber}`,
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
      const person = await createPerson(personInput);
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
  await assignCompetitionRole(competitionId, personId, 'PILOT');
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

  return prisma.pilot.create({
    data: {
      ...pilotFields,
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
      isWomen: pilotFields.gender === 'FEMALE' || pilotFields.isWomen === true || person.gender === 'FEMALE',
    },
    include: {
      country: true,
      person: { select: { id: true, aeroJudgeId: true, civlId: true } },
    },
  });
}

export async function updatePilot(
  competitionId: string,
  pilotId: string,
  data: Omit<Prisma.PilotUncheckedUpdateInput, 'id' | 'competitionId'>,
) {
  await getPilot(competitionId, pilotId);
  const { gender, nationality, countryId, ...rest } = data;

  let nextCountryId = countryId;
  if (nextCountryId === undefined && typeof nationality === 'string') {
    nextCountryId = (await resolveCountryId(nationality)) ?? undefined;
  }

  return prisma.pilot.update({
    where: { id: pilotId },
    data: {
      ...rest,
      ...(nationality !== undefined ? { nationality } : {}),
      ...(nextCountryId !== undefined ? { countryId: nextCountryId } : {}),
      ...(gender !== undefined
        ? { gender, isWomen: gender === 'FEMALE' }
        : {}),
    },
    include: { country: true },
  });
}

export async function deletePilot(competitionId: string, pilotId: string): Promise<void> {
  const pilot = await getPilot(competitionId, pilotId);
  const personId = pilot.personId;

  await prisma.pilot.delete({ where: { id: pilotId } });

  // Drop PILOT role but never delete the global Person or other competition roles.
  if (personId) {
    const { removeCompetitionRole } = await import('./competition-participant.service.js');
    try {
      await removeCompetitionRole(competitionId, personId, 'PILOT');
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

    const pilotNumber = Number(
      col(cols, 'pilotnumber', 'number', 'pilotno') ?? cols[0],
    );
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

    // Ambiguous: multiple exacts or only possibles with no strong id — require human review.
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
    // keep type happy if unused
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
