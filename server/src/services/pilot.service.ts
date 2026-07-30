import { generateQrPayload, parseCsvLine, formatPilotName } from '@npha/utils';
import type { Prisma } from '@npha/database';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { getCompetition } from './competition.service.js';

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
    ];
  }

  const [items, total] = await Promise.all([
    prisma.pilot.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { pilotNumber: 'asc' },
      include: { country: true },
    }),
    prisma.pilot.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getPilot(competitionId: string, pilotId: string) {
  const pilot = await prisma.pilot.findFirst({
    where: { id: pilotId, competitionId },
    include: { country: true, teamMembers: { include: { team: true } } },
  });
  if (!pilot) throw AppError.notFound('Pilot not found');
  return pilot;
}

export async function createPilot(
  competitionId: string,
  data: Omit<Prisma.PilotUncheckedCreateInput, 'competitionId'>,
) {
  await getCompetition(competitionId);
  const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
  const qrCode = generateQrPayload(env.PUBLIC_RESULTS_URL, competition!.publicSlug, `/pilot/${data.pilotNumber}`);

  return prisma.pilot.create({
    data: {
      ...data,
      competitionId,
      qrCode,
      isWomen: data.gender === 'FEMALE' || data.isWomen === true,
    },
    include: { country: true },
  });
}

export async function updatePilot(
  competitionId: string,
  pilotId: string,
  data: Prisma.PilotUpdateInput,
) {
  await getPilot(competitionId, pilotId);
  return prisma.pilot.update({
    where: { id: pilotId },
    data: {
      ...data,
      isWomen: data.gender === 'FEMALE' ? true : data.isWomen,
    },
    include: { country: true },
  });
}

export async function deletePilot(competitionId: string, pilotId: string): Promise<void> {
  await getPilot(competitionId, pilotId);
  await prisma.pilot.delete({ where: { id: pilotId } });
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

export async function importPilotsFromCsv(competitionId: string, csvContent: string) {
  await getCompetition(competitionId);
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw AppError.badRequest('CSV must include header and at least one row');

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const colIndex = (name: string): number => header.indexOf(name);

  const created = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.every((c) => !c)) continue;

    const numIdx = colIndex('pilotnumber');
    const numberIdx = colIndex('number');
    const pilotNumber = Number(cols[numIdx >= 0 ? numIdx : numberIdx >= 0 ? numberIdx : 0]);
    const firstNameIdx = colIndex('firstname');
    const lastNameIdx = colIndex('lastname');
    const firstName = firstNameIdx >= 0 ? cols[firstNameIdx] : cols[1];
    const lastName = lastNameIdx >= 0 ? cols[lastNameIdx] : cols[2];
    const genderIdx = colIndex('gender');
    const gender = (genderIdx >= 0 ? cols[genderIdx] : 'MALE').toUpperCase() as 'MALE' | 'FEMALE' | 'OTHER';
    const natIdx = colIndex('nationality');
    const countryIdx = colIndex('country');
    const nationality = natIdx >= 0 ? cols[natIdx] : countryIdx >= 0 ? cols[countryIdx] : undefined;

    if (!pilotNumber || !firstName || !lastName) {
      throw AppError.badRequest(`Invalid row ${i + 1}: pilotNumber, firstName, lastName required`);
    }

    const pilot = await createPilot(competitionId, {
      pilotNumber,
      firstName,
      lastName,
      gender,
      nationality,
    });
    created.push(pilot);
  }

  return { imported: created.length, pilots: created };
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
