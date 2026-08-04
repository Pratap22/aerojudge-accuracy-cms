import { createHash, randomBytes } from 'node:crypto';
import type { Gender, Person, Prisma } from '@npha/database';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { resolveCountryId } from '../utils/country-resolve.js';

/** Base32-ish alphabet without ambiguous 0/O/1/I. */
const AJ_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateAeroJudgeId(): string {
  const bytes = randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += AJ_CHARS[bytes[i]! % AJ_CHARS.length];
  }
  return `AJ-${code}`;
}

export async function allocateAeroJudgeId(tx: Prisma.TransactionClient = prisma): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const aeroJudgeId = generateAeroJudgeId();
    const existing = await tx.person.findUnique({
      where: { aeroJudgeId },
      select: { id: true },
    });
    if (!existing) return aeroJudgeId;
  }
  // Extremely unlikely fallback
  const fallback = `AJ-${createHash('sha256').update(randomBytes(16)).digest('hex').slice(0, 6).toUpperCase()}`;
  return fallback;
}

export type PersonPublicView = {
  id: string;
  aeroJudgeId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  preferredName: string | null;
  displayName: string | null;
  gender: Gender;
  nationalityCountryId: string | null;
  nationalityCountry?: { id: string; code: string; name: string; code2: string } | null;
  photoUrl: string | null;
  civlId: string | null;
  faiLicenseNumber: string | null;
  visibility: string;
  status: string;
};

export type PersonPrivateView = PersonPublicView & {
  dateOfBirth: Date | null;
  email: string | null;
  emailVerifiedAt: Date | null;
  phone: string | null;
  faiLicenseExpiry: Date | null;
};

/** Directory / public-safe identity fields (no contact, no DOB). */
export function toPersonDirectoryView(
  person: Person & {
    nationalityCountry?: { id: string; code: string; name: string; code2: string } | null;
  },
): PersonPublicView {
  return {
    id: person.id,
    aeroJudgeId: person.aeroJudgeId,
    firstName: person.firstName,
    middleName: person.middleName,
    lastName: person.lastName,
    preferredName: person.preferredName,
    displayName: person.displayName,
    gender: person.gender,
    nationalityCountryId: person.nationalityCountryId,
    nationalityCountry: person.nationalityCountry ?? null,
    photoUrl: person.photoUrl,
    civlId: person.civlId,
    faiLicenseNumber: person.faiLicenseNumber,
    visibility: person.visibility,
    status: person.status,
  };
}

export function toPersonPrivateView(
  person: Person & {
    nationalityCountry?: { id: string; code: string; name: string; code2: string } | null;
  },
): PersonPrivateView {
  return {
    ...toPersonDirectoryView(person),
    dateOfBirth: person.dateOfBirth,
    email: person.email,
    emailVerifiedAt: person.emailVerifiedAt,
    phone: person.phone,
    faiLicenseExpiry: person.faiLicenseExpiry,
  };
}

export function personDisplayName(person: {
  displayName?: string | null;
  preferredName?: string | null;
  firstName: string;
  lastName: string;
}): string {
  if (person.displayName?.trim()) return person.displayName.trim();
  if (person.preferredName?.trim()) {
    return `${person.preferredName.trim()} ${person.lastName}`.trim();
  }
  return `${person.firstName} ${person.lastName}`.trim();
}

type PhotoCandidate = { personId: string; url: string; updatedAt: Date };

/**
 * Batch-resolve profile photos for people missing Person.photoUrl by reusing the
 * newest linked pilot headshot or official image. Lazily backfills Person.photoUrl.
 */
export async function resolveMissingPersonPhotoUrls(
  people: Array<{ id: string; photoUrl: string | null }>,
): Promise<Map<string, string | null>> {
  const resolved = new Map<string, string | null>();
  const missingIds: string[] = [];

  for (const person of people) {
    if (person.photoUrl) {
      resolved.set(person.id, person.photoUrl);
    } else {
      missingIds.push(person.id);
      resolved.set(person.id, null);
    }
  }

  if (missingIds.length === 0) return resolved;

  const [pilots, officials] = await Promise.all([
    prisma.pilot.findMany({
      where: { personId: { in: missingIds }, photoUrl: { not: null } },
      select: { personId: true, photoUrl: true, updatedAt: true },
    }),
    prisma.competitionOfficial.findMany({
      where: { personId: { in: missingIds }, imageUrl: { not: null } },
      select: { personId: true, imageUrl: true, updatedAt: true },
    }),
  ]);

  const newestByPerson = new Map<string, PhotoCandidate>();
  const consider = (candidate: PhotoCandidate) => {
    const prev = newestByPerson.get(candidate.personId);
    if (!prev || candidate.updatedAt > prev.updatedAt) {
      newestByPerson.set(candidate.personId, candidate);
    }
  };

  for (const row of pilots) {
    if (row.personId && row.photoUrl) {
      consider({ personId: row.personId, url: row.photoUrl, updatedAt: row.updatedAt });
    }
  }
  for (const row of officials) {
    if (row.personId && row.imageUrl) {
      consider({ personId: row.personId, url: row.imageUrl, updatedAt: row.updatedAt });
    }
  }

  const backfillIds: string[] = [];
  for (const [personId, candidate] of newestByPerson) {
    resolved.set(personId, candidate.url);
    backfillIds.push(personId);
  }

  if (backfillIds.length > 0) {
    await Promise.all(
      backfillIds.map((personId) =>
        prisma.person.updateMany({
          where: { id: personId, photoUrl: null },
          data: { photoUrl: newestByPerson.get(personId)!.url },
        }),
      ),
    );
  }

  return resolved;
}

/** Prefer Person.photoUrl; otherwise reuse newest pilot/official photo (and backfill). */
export async function resolvePersonPhotoUrl(
  personId: string,
  currentPhotoUrl?: string | null,
): Promise<string | null> {
  if (currentPhotoUrl) return currentPhotoUrl;
  const map = await resolveMissingPersonPhotoUrls([{ id: personId, photoUrl: null }]);
  return map.get(personId) ?? null;
}

export type CreatePersonInput = {
  firstName: string;
  lastName: string;
  middleName?: string;
  preferredName?: string;
  displayName?: string;
  gender?: Gender;
  dateOfBirth?: Date | string | null;
  nationalityCountryId?: string | null;
  nationality?: string | null;
  photoUrl?: string | null;
  civlId?: string | null;
  faiLicenseNumber?: string | null;
  faiLicenseExpiry?: Date | string | null;
  email?: string | null;
  phone?: string | null;
  visibility?: 'PRIVATE' | 'ORGANIZATIONS_ONLY' | 'PUBLIC';
  /** Skip exact-match guard (caller already confirmed). */
  forceCreate?: boolean;
};

export async function createPerson(input: CreatePersonInput, opts?: { actorUserId?: string }) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) {
    throw AppError.badRequest('firstName and lastName are required');
  }

  const civlId = input.civlId?.trim() || null;
  const faiLicenseNumber = input.faiLicenseNumber?.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;

  if (!input.forceCreate) {
    const matches = await matchPersons({
      civlId: civlId ?? undefined,
      faiLicenseNumber: faiLicenseNumber ?? undefined,
      email: email ?? undefined,
      firstName,
      lastName,
      nationalityCountryId: input.nationalityCountryId ?? undefined,
    });
    const exact = matches.filter((m) => m.confidence === 'EXACT');
    if (exact.length > 0) {
      throw AppError.conflict(
        `Exact person match found (${exact[0]!.person.aeroJudgeId}). Use existing person or forceCreate.`,
        'CONFLICT',
        { matches: exact },
      );
    }
  }

  if (civlId) {
    const existingCivl = await prisma.person.findFirst({
      where: { civlId, status: 'ACTIVE' },
    });
    if (existingCivl) {
      throw AppError.conflict(`CIVL ID already registered to ${existingCivl.aeroJudgeId}`, 'CONFLICT', {
        personId: existingCivl.id,
        aeroJudgeId: existingCivl.aeroJudgeId,
      });
    }
  }

  let nationalityCountryId = input.nationalityCountryId ?? null;
  if (!nationalityCountryId && input.nationality) {
    nationalityCountryId = (await resolveCountryId(input.nationality)) ?? null;
  }

  const person = await prisma.$transaction(async (tx) => {
    const aeroJudgeId = await allocateAeroJudgeId(tx);
    return tx.person.create({
      data: {
        aeroJudgeId,
        firstName,
        lastName,
        middleName: input.middleName?.trim() || null,
        preferredName: input.preferredName?.trim() || null,
        displayName: input.displayName?.trim() || null,
        gender: input.gender ?? 'MALE',
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        nationalityCountryId,
        photoUrl: input.photoUrl ?? null,
        civlId,
        faiLicenseNumber,
        faiLicenseExpiry: input.faiLicenseExpiry ? new Date(input.faiLicenseExpiry) : null,
        email,
        phone: input.phone?.trim() || null,
        visibility: input.visibility ?? 'PRIVATE',
      },
      include: { nationalityCountry: true },
    });
  });

  if (opts?.actorUserId) {
    await prisma.auditLog.create({
      data: {
        userId: opts.actorUserId,
        action: 'PERSON_CREATED',
        entityType: 'Person',
        entityId: person.id,
        afterJson: {
          aeroJudgeId: person.aeroJudgeId,
          firstName: person.firstName,
          lastName: person.lastName,
          civlId: person.civlId,
        },
      },
    });
  }

  return person;
}

export async function getPerson(personId: string) {
  const person = await prisma.person.findFirst({
    where: { id: personId, status: { not: 'MERGED' } },
    include: { nationalityCountry: true, user: { select: { id: true, email: true, status: true } } },
  });
  if (!person) throw AppError.notFound('Person not found');
  return person;
}

export async function getPersonByAeroJudgeId(aeroJudgeId: string) {
  const person = await prisma.person.findFirst({
    where: { aeroJudgeId: aeroJudgeId.trim().toUpperCase(), status: { not: 'MERGED' } },
    include: { nationalityCountry: true },
  });
  if (!person) throw AppError.notFound('Person not found');
  return person;
}

export async function updatePerson(
  personId: string,
  data: Partial<CreatePersonInput>,
  opts?: { actorUserId?: string },
) {
  const existing = await getPerson(personId);

  if (data.civlId !== undefined) {
    const civlId = data.civlId?.trim() || null;
    if (civlId) {
      const clash = await prisma.person.findFirst({
        where: { civlId, status: 'ACTIVE', NOT: { id: personId } },
      });
      if (clash) {
        throw AppError.conflict(`CIVL ID already registered to ${clash.aeroJudgeId}`);
      }
    }
  }

  let nationalityCountryId = data.nationalityCountryId;
  if (nationalityCountryId === undefined && data.nationality) {
    nationalityCountryId = (await resolveCountryId(data.nationality)) ?? undefined;
  }

  const updated = await prisma.person.update({
    where: { id: personId },
    data: {
      ...(data.firstName != null ? { firstName: data.firstName.trim() } : {}),
      ...(data.lastName != null ? { lastName: data.lastName.trim() } : {}),
      ...(data.middleName !== undefined ? { middleName: data.middleName?.trim() || null } : {}),
      ...(data.preferredName !== undefined
        ? { preferredName: data.preferredName?.trim() || null }
        : {}),
      ...(data.displayName !== undefined ? { displayName: data.displayName?.trim() || null } : {}),
      ...(data.gender != null ? { gender: data.gender } : {}),
      ...(data.dateOfBirth !== undefined
        ? { dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null }
        : {}),
      ...(nationalityCountryId !== undefined ? { nationalityCountryId } : {}),
      ...(data.photoUrl !== undefined ? { photoUrl: data.photoUrl } : {}),
      ...(data.civlId !== undefined ? { civlId: data.civlId?.trim() || null } : {}),
      ...(data.faiLicenseNumber !== undefined
        ? { faiLicenseNumber: data.faiLicenseNumber?.trim() || null }
        : {}),
      ...(data.faiLicenseExpiry !== undefined
        ? { faiLicenseExpiry: data.faiLicenseExpiry ? new Date(data.faiLicenseExpiry) : null }
        : {}),
      ...(data.email !== undefined ? { email: data.email?.trim().toLowerCase() || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
      ...(data.visibility != null ? { visibility: data.visibility } : {}),
    },
    include: { nationalityCountry: true },
  });

  if (opts?.actorUserId) {
    await prisma.auditLog.create({
      data: {
        userId: opts.actorUserId,
        action: 'PERSON_UPDATED',
        entityType: 'Person',
        entityId: personId,
        beforeJson: {
          firstName: existing.firstName,
          lastName: existing.lastName,
          civlId: existing.civlId,
        },
        afterJson: {
          firstName: updated.firstName,
          lastName: updated.lastName,
          civlId: updated.civlId,
        },
      },
    });
  }

  return updated;
}

export type MatchInput = {
  aeroJudgeId?: string;
  civlId?: string;
  faiLicenseNumber?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  nationalityCountryId?: string;
  query?: string;
};

export type PersonMatch = {
  confidence: 'EXACT' | 'POSSIBLE';
  reason: string;
  person: PersonPublicView;
};

/** Find existing persons — never auto-merges. Strong ids → EXACT; name+country → POSSIBLE. */
export async function matchPersons(input: MatchInput): Promise<PersonMatch[]> {
  const results: PersonMatch[] = [];
  const seen = new Set<string>();

  const push = (
    person: Person & {
      nationalityCountry?: { id: string; code: string; name: string; code2: string } | null;
    },
    confidence: 'EXACT' | 'POSSIBLE',
    reason: string,
  ) => {
    if (person.status === 'MERGED' || seen.has(person.id)) return;
    seen.add(person.id);
    results.push({ confidence, reason, person: toPersonDirectoryView(person) });
  };

  if (input.aeroJudgeId?.trim()) {
    const aj = input.aeroJudgeId.trim().toUpperCase();
    const person = await prisma.person.findFirst({
      where: { aeroJudgeId: aj, status: 'ACTIVE' },
      include: { nationalityCountry: true },
    });
    if (person) push(person, 'EXACT', 'aeroJudgeId');
  }

  if (input.civlId?.trim()) {
    const person = await prisma.person.findFirst({
      where: { civlId: input.civlId.trim(), status: 'ACTIVE' },
      include: { nationalityCountry: true },
    });
    if (person) push(person, 'EXACT', 'civlId');
  }

  if (input.email?.trim()) {
    const person = await prisma.person.findFirst({
      where: {
        email: input.email.trim().toLowerCase(),
        emailVerifiedAt: { not: null },
        status: 'ACTIVE',
      },
      include: { nationalityCountry: true },
    });
    if (person) push(person, 'EXACT', 'verifiedEmail');
  }

  if (input.faiLicenseNumber?.trim()) {
    const persons = await prisma.person.findMany({
      where: { faiLicenseNumber: input.faiLicenseNumber.trim(), status: 'ACTIVE' },
      include: { nationalityCountry: true },
      take: 10,
    });
    for (const person of persons) {
      push(person, persons.length === 1 ? 'EXACT' : 'POSSIBLE', 'faiLicense');
    }
  }

  if (input.firstName?.trim() && input.lastName?.trim()) {
    const where: Prisma.PersonWhereInput = {
      status: 'ACTIVE',
      firstName: { equals: input.firstName.trim(), mode: 'insensitive' },
      lastName: { equals: input.lastName.trim(), mode: 'insensitive' },
    };
    if (input.nationalityCountryId) {
      where.nationalityCountryId = input.nationalityCountryId;
    }
    const persons = await prisma.person.findMany({
      where,
      include: { nationalityCountry: true },
      take: 20,
    });
    for (const person of persons) {
      push(
        person,
        input.nationalityCountryId ? 'POSSIBLE' : 'POSSIBLE',
        input.nationalityCountryId ? 'nameAndCountry' : 'name',
      );
    }
  }

  if (input.query?.trim()) {
    const q = input.query.trim();
    const upper = q.toUpperCase();
    const or: Prisma.PersonWhereInput[] = [
      { aeroJudgeId: { equals: upper, mode: 'insensitive' } },
      { civlId: { equals: q, mode: 'insensitive' } },
      { faiLicenseNumber: { contains: q, mode: 'insensitive' } },
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
    ];
    if (q.includes(' ')) {
      const [first, ...rest] = q.split(/\s+/);
      or.push({
        AND: [
          { firstName: { contains: first, mode: 'insensitive' } },
          { lastName: { contains: rest.join(' '), mode: 'insensitive' } },
        ],
      });
    }
    const persons = await prisma.person.findMany({
      where: { status: 'ACTIVE', OR: or },
      include: { nationalityCountry: true },
      take: 25,
    });
    for (const person of persons) {
      const confidence =
        person.aeroJudgeId.toUpperCase() === upper || person.civlId === q ? 'EXACT' : 'POSSIBLE';
      const reason =
        person.aeroJudgeId.toUpperCase() === upper
          ? 'aeroJudgeId'
          : person.civlId === q
            ? 'civlId'
            : 'search';
      push(person, confidence, reason);
    }
  }

  // EXACT first
  results.sort((a, b) => {
    if (a.confidence === b.confidence) return 0;
    return a.confidence === 'EXACT' ? -1 : 1;
  });
  return results;
}

export async function searchPeopleDirectory(query: {
  q?: string;
  page?: number;
  pageSize?: number;
  civlId?: string;
  aeroJudgeId?: string;
}) {
  const page = query.page ?? 1;
  const pageSize = Math.min(query.pageSize ?? 20, 100);
  const where: Prisma.PersonWhereInput = { status: 'ACTIVE' };

  if (query.aeroJudgeId?.trim()) {
    where.aeroJudgeId = { equals: query.aeroJudgeId.trim().toUpperCase(), mode: 'insensitive' };
  } else if (query.civlId?.trim()) {
    where.civlId = { equals: query.civlId.trim(), mode: 'insensitive' };
  } else if (query.q?.trim()) {
    const q = query.q.trim();
    where.OR = [
      { aeroJudgeId: { contains: q.toUpperCase(), mode: 'insensitive' } },
      { civlId: { contains: q, mode: 'insensitive' } },
      { faiLicenseNumber: { contains: q, mode: 'insensitive' } },
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.person.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: { nationalityCountry: true },
    }),
    prisma.person.count({ where }),
  ]);

  const photoById = await resolveMissingPersonPhotoUrls(
    items.map((person) => ({ id: person.id, photoUrl: person.photoUrl })),
  );

  return {
    items: items.map((person) => ({
      ...toPersonDirectoryView(person),
      photoUrl: photoById.get(person.id) ?? person.photoUrl,
    })),
    total,
    page,
    pageSize,
  };
}

export async function getPersonCompetitionHistory(personId: string) {
  await getPerson(personId);
  const participations = await prisma.competitionParticipant.findMany({
    where: { personId },
    include: {
      competition: {
        select: {
          id: true,
          name: true,
          code: true,
          startDate: true,
          endDate: true,
          status: true,
          country: true,
          venue: true,
          isPublished: true,
        },
      },
      roles: true,
      pilot: {
        select: {
          id: true,
          pilotNumber: true,
          status: true,
          firstName: true,
          lastName: true,
          nationality: true,
          glider: true,
        },
      },
    },
    orderBy: { registrationDate: 'desc' },
  });

  return participations.map((p) => ({
    id: p.id,
    status: p.status,
    registrationDate: p.registrationDate,
    roles: p.roles.map((r) => r.role),
    /** Verified = participation stored in AeroJudge competition records (not FAI cert). */
    verified: true,
    competition: p.competition,
    pilotSnapshot: p.pilot
      ? {
          id: p.pilot.id,
          pilotNumber: p.pilot.pilotNumber,
          status: p.pilot.status,
          displayName: `${p.pilot.firstName} ${p.pilot.lastName}`,
          nationality: p.pilot.nationality,
          glider: p.pilot.glider,
        }
      : null,
  }));
}

/** Ensure a User has a linked Person (create from user name if missing). */
export async function ensureUserPerson(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User not found');
  if (user.personId) {
    return getPerson(user.personId);
  }

  const person = await createPerson(
    {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      photoUrl: user.avatarUrl,
      forceCreate: true,
    },
    { actorUserId: userId },
  );

  await prisma.user.update({
    where: { id: userId },
    data: { personId: person.id },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'PERSON_LINKED',
      entityType: 'Person',
      entityId: person.id,
      afterJson: { userId, personId: person.id },
    },
  });

  return person;
}

/**
 * Controlled merge: move relations from duplicate → canonical, archive duplicate.
 * Never deletes competition history rows.
 */
export async function mergePersons(
  canonicalPersonId: string,
  duplicatePersonId: string,
  performedByUserId?: string,
) {
  if (canonicalPersonId === duplicatePersonId) {
    throw AppError.badRequest('Cannot merge a person into themselves');
  }

  const [canonical, duplicate] = await Promise.all([
    getPerson(canonicalPersonId),
    prisma.person.findUnique({ where: { id: duplicatePersonId } }),
  ]);
  if (!duplicate || duplicate.status === 'MERGED') {
    throw AppError.notFound('Duplicate person not found or already merged');
  }

  const before = {
    canonical: {
      id: canonical.id,
      aeroJudgeId: canonical.aeroJudgeId,
      civlId: canonical.civlId,
    },
    duplicate: {
      id: duplicate.id,
      aeroJudgeId: duplicate.aeroJudgeId,
      civlId: duplicate.civlId,
    },
  };

  await prisma.$transaction(async (tx) => {
    // Move pilot FKs
    await tx.pilot.updateMany({
      where: { personId: duplicatePersonId },
      data: { personId: canonicalPersonId },
    });
    await tx.competitionOfficial.updateMany({
      where: { personId: duplicatePersonId },
      data: { personId: canonicalPersonId },
    });

    // Re-point participants (handle unique conflict by merging roles)
    const dupParts = await tx.competitionParticipant.findMany({
      where: { personId: duplicatePersonId },
      include: { roles: true },
    });

    for (const part of dupParts) {
      const existing = await tx.competitionParticipant.findUnique({
        where: {
          competitionId_personId: {
            competitionId: part.competitionId,
            personId: canonicalPersonId,
          },
        },
        include: { roles: true },
      });

      if (!existing) {
        await tx.competitionParticipant.update({
          where: { id: part.id },
          data: { personId: canonicalPersonId },
        });
        continue;
      }

      for (const role of part.roles) {
        const hasRole = existing.roles.some((r) => r.role === role.role);
        if (!hasRole) {
          await tx.competitionParticipantRole.create({
            data: {
              competitionParticipantId: existing.id,
              role: role.role,
              notes: role.notes,
            },
          });
        }
      }

      await tx.pilot.updateMany({
        where: { competitionParticipantId: part.id },
        data: { competitionParticipantId: existing.id, personId: canonicalPersonId },
      });
      await tx.competitionOfficial.updateMany({
        where: { competitionParticipantId: part.id },
        data: { competitionParticipantId: existing.id, personId: canonicalPersonId },
      });
      await tx.competitionParticipantRole.deleteMany({ where: { competitionParticipantId: part.id } });
      await tx.competitionParticipant.delete({ where: { id: part.id } });
    }

    // User links
    await tx.user.updateMany({
      where: { personId: duplicatePersonId },
      data: { personId: canonicalPersonId },
    });
    await tx.profileClaimRequest.updateMany({
      where: { personId: duplicatePersonId },
      data: { personId: canonicalPersonId },
    });

    // Prefer filling empty fields on canonical from duplicate
    await tx.person.update({
      where: { id: canonicalPersonId },
      data: {
        civlId: canonical.civlId ?? duplicate.civlId,
        faiLicenseNumber: canonical.faiLicenseNumber ?? duplicate.faiLicenseNumber,
        email: canonical.email ?? duplicate.email,
        phone: canonical.phone ?? duplicate.phone,
        photoUrl: canonical.photoUrl ?? duplicate.photoUrl,
        nationalityCountryId: canonical.nationalityCountryId ?? duplicate.nationalityCountryId,
        dateOfBirth: canonical.dateOfBirth ?? duplicate.dateOfBirth,
      },
    });

    await tx.person.update({
      where: { id: duplicatePersonId },
      data: {
        status: 'MERGED',
        mergedIntoId: canonicalPersonId,
        civlId: null, // free unique CIVL for active person
      },
    });

    await tx.personMergeLog.create({
      data: {
        canonicalPersonId,
        duplicatePersonId,
        performedByUserId,
        beforeJson: before,
        afterJson: { merged: true },
      },
    });
  });

  await prisma.auditLog.create({
    data: {
      userId: performedByUserId,
      action: 'PERSON_MERGED',
      entityType: 'Person',
      entityId: canonicalPersonId,
      beforeJson: before,
      afterJson: { duplicatePersonId, canonicalPersonId },
    },
  });

  return getPerson(canonicalPersonId);
}

/**
 * Request to claim a Person profile for a User.
 * Never auto-approves from public identity data alone.
 */
export async function requestProfileClaim(
  personId: string,
  userId: string,
  verificationMethod: string,
) {
  const person = await getPerson(personId);
  if (person.status !== 'ACTIVE') throw AppError.badRequest('Person is not claimable');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User not found');
  if (user.personId && user.personId !== personId) {
    throw AppError.conflict('User is already linked to a different Person');
  }

  // Secure path: verified email match may auto-link later after review flow
  const method = verificationMethod.trim();
  if (!method) throw AppError.badRequest('verificationMethod is required');

  const existing = await prisma.profileClaimRequest.findFirst({
    where: { personId, userId, status: 'PENDING' },
  });
  if (existing) return existing;

  const claim = await prisma.profileClaimRequest.create({
    data: {
      personId,
      userId,
      status: 'PENDING',
      verificationMethod: method,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'PROFILE_CLAIM_REQUESTED',
      entityType: 'ProfileClaimRequest',
      entityId: claim.id,
      afterJson: { personId, verificationMethod: method },
    },
  });

  return claim;
}

/** Approve claim — only via authorized review, never public auto-match. */
export async function approveProfileClaim(claimId: string, reviewedByUserId: string) {
  const claim = await prisma.profileClaimRequest.findUnique({ where: { id: claimId } });
  if (!claim) throw AppError.notFound('Claim request not found');
  if (claim.status !== 'PENDING') throw AppError.badRequest('Claim is not pending');

  const person = await getPerson(claim.personId);
  const linkedUser = await prisma.user.findFirst({
    where: { personId: person.id, NOT: { id: claim.userId } },
  });
  if (linkedUser) {
    throw AppError.conflict('Person is already linked to another user account');
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: claim.userId },
      data: { personId: person.id },
    });
    await tx.profileClaimRequest.update({
      where: { id: claimId },
      data: {
        status: 'APPROVED',
        reviewedByUserId,
        reviewedAt: new Date(),
      },
    });
  });

  await prisma.auditLog.create({
    data: {
      userId: reviewedByUserId,
      action: 'PROFILE_CLAIMED',
      entityType: 'Person',
      entityId: person.id,
      afterJson: { userId: claim.userId, claimId },
    },
  });

  return getPerson(person.id);
}

/**
 * Secure claim: link User → existing Person only when the login email matches
 * the Person's stored email (proves control of the inbox for that identity).
 * Otherwise creates a PENDING claim for organizer review (not auto-linked).
 */
export async function claimPersonByVerifiedEmail(
  userId: string,
  input: { personId?: string; aeroJudgeId?: string; civlId?: string },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'ACTIVE') throw AppError.unauthorized();

  if (user.personId) {
    const current = await getPerson(user.personId);
    return {
      status: 'ALREADY_LINKED' as const,
      person: toPersonDirectoryView(current),
      claim: null,
    };
  }

  let person =
    input.personId != null
      ? await prisma.person.findFirst({
          where: { id: input.personId, status: 'ACTIVE' },
          include: { nationalityCountry: true },
        })
      : null;

  if (!person && input.aeroJudgeId?.trim()) {
    person = await prisma.person.findFirst({
      where: {
        aeroJudgeId: input.aeroJudgeId.trim().toUpperCase(),
        status: 'ACTIVE',
      },
      include: { nationalityCountry: true },
    });
  }

  if (!person && input.civlId?.trim()) {
    person = await prisma.person.findFirst({
      where: { civlId: input.civlId.trim(), status: 'ACTIVE' },
      include: { nationalityCountry: true },
    });
  }

  if (!person) throw AppError.notFound('No matching Person found');

  const otherUser = await prisma.user.findFirst({
    where: { personId: person.id, NOT: { id: userId } },
  });
  if (otherUser) {
    throw AppError.conflict('This profile is already linked to another AeroJudge account');
  }

  const userEmail = user.email.toLowerCase();
  const personEmail = person.email?.toLowerCase() ?? null;

  if (personEmail && personEmail === userEmail) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { personId: person!.id },
      });
      await tx.person.update({
        where: { id: person!.id },
        data: { emailVerifiedAt: new Date() },
      });
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'PROFILE_CLAIMED',
        entityType: 'Person',
        entityId: person.id,
        afterJson: { verificationMethod: 'VERIFIED_EMAIL_MATCH' },
      },
    });

    const claimed = await getPerson(person.id);
    return {
      status: 'CLAIMED' as const,
      person: toPersonDirectoryView(claimed),
      claim: null,
    };
  }

  // Not auto-claimable — queue for organizer review
  const claim = await requestProfileClaim(person.id, userId, 'AWAITING_ORGANIZER');
  return {
    status: 'PENDING_APPROVAL' as const,
    person: toPersonDirectoryView(person),
    claim,
    message:
      personEmail == null
        ? 'This profile has no verified email on file. An organiser must approve your claim.'
        : 'Your login email does not match this profile. An organiser must approve your claim.',
  };
}

/**
 * Directory lookup for claim UX (authenticated). Returns whether email can auto-claim.
 */
export async function lookupPersonForClaim(
  userId: string,
  input: { aeroJudgeId?: string; civlId?: string },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.unauthorized();

  const matches = await matchPersons({
    aeroJudgeId: input.aeroJudgeId,
    civlId: input.civlId,
  });
  const exact = matches.filter((m) => m.confidence === 'EXACT');
  if (exact.length === 0) {
    return { matches: [], claimableByEmail: false };
  }

  // Enrich with claimability (need email on person — fetch private field)
  const enriched = await Promise.all(
    exact.map(async (m) => {
      const full = await prisma.person.findUnique({
        where: { id: m.person.id },
        select: { email: true },
      });
      const claimableByEmail =
        !!full?.email && full.email.toLowerCase() === user.email.toLowerCase();
      return {
        ...m,
        claimableByEmail,
      };
    }),
  );

  return { matches: enriched, claimableByEmail: enriched.some((e) => e.claimableByEmail) };
}

/** Public profile payload — never includes contact or sensitive fields. */
export async function getPublicProfile(aeroJudgeId: string) {
  const person = await prisma.person.findFirst({
    where: {
      aeroJudgeId: aeroJudgeId.trim().toUpperCase(),
      status: 'ACTIVE',
      visibility: 'PUBLIC',
    },
    include: { nationalityCountry: true },
  });
  if (!person) throw AppError.notFound('Profile not found');

  const history = await getPersonCompetitionHistory(person.id);

  return {
    aeroJudgeId: person.aeroJudgeId,
    displayName: personDisplayName(person),
    firstName: person.firstName,
    lastName: person.lastName,
    photoUrl: person.photoUrl,
    nationality: person.nationalityCountry
      ? { code: person.nationalityCountry.code, name: person.nationalityCountry.name }
      : null,
    civlId: person.civlId,
    rolesSummary: [...new Set(history.flatMap((h) => h.roles))],
    competitionHistory: history
      .filter((h) => h.competition.isPublished)
      .map((h) => ({
        competitionName: h.competition.name,
        year: h.competition.startDate.getFullYear(),
        roles: h.roles,
        verified: h.verified,
      })),
  };
}
