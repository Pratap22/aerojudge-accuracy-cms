import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  assertPilotJudgePolicy,
  isJudgeOrOfficialRole,
  isPilotRole,
  mapOfficialLabelToRole,
} from '../services/competition-participant.service.js';
import {
  generateAeroJudgeId,
  personDisplayName,
  personNameSearchOrClauses,
} from '../services/person.service.js';
import { AppError } from '../utils/errors.js';

describe('Person identity architecture', () => {
  describe('AeroJudge ID', () => {
    it('generates AJ-XXXXXX format without ambiguous characters', () => {
      for (let i = 0; i < 20; i++) {
        const id = generateAeroJudgeId();
        expect(id).toMatch(/^AJ-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
      }
    });
  });

  describe('personNameSearchOrClauses', () => {
    it('matches a single token against any name field', () => {
      const clauses = personNameSearchOrClauses('Thapa');
      expect(clauses).toHaveLength(1);
      expect(clauses[0]).toMatchObject({
        OR: expect.arrayContaining([
          { lastName: { contains: 'Thapa', mode: 'insensitive' } },
          { firstName: { contains: 'Thapa', mode: 'insensitive' } },
        ]),
      });
    });

    it('requires every token of a full name to appear in some name field', () => {
      const clauses = personNameSearchOrClauses('Aman Thapa');
      expect(clauses.some((c) => 'AND' in c && Array.isArray(c.AND) && c.AND.length === 2)).toBe(
        true,
      );
      const tokenAnd = clauses.find((c) => 'AND' in c && Array.isArray(c.AND) && c.AND.length === 2);
      expect(JSON.stringify(tokenAnd)).toContain('"contains":"Aman"');
      expect(JSON.stringify(tokenAnd)).toContain('"contains":"Thapa"');
    });

    it('ignores extra whitespace', () => {
      expect(personNameSearchOrClauses('  Aman   Thapa  ')).toEqual(
        personNameSearchOrClauses('Aman Thapa'),
      );
    });
  });

  describe('personDisplayName', () => {
    it('prefers displayName then preferredName then legal name', () => {
      expect(
        personDisplayName({
          firstName: 'Pratap',
          lastName: 'Sharma',
          displayName: 'P. Sharma',
        }),
      ).toBe('P. Sharma');
      expect(
        personDisplayName({
          firstName: 'Pratap',
          lastName: 'Sharma',
          preferredName: 'Pat',
        }),
      ).toBe('Pat Sharma');
      expect(personDisplayName({ firstName: 'Pratap', lastName: 'Sharma' })).toBe('Pratap Sharma');
    });
  });

  describe('competition roles policy', () => {
    it('recognizes pilot vs judge/official roles', () => {
      expect(isPilotRole('PILOT')).toBe(true);
      expect(isJudgeOrOfficialRole('TARGET_JUDGE')).toBe(true);
      expect(isJudgeOrOfficialRole('PILOT')).toBe(false);
    });

    it('allows multiple official roles in the same competition', () => {
      expect(() => assertPilotJudgePolicy(['JUDGE'], 'ANNOUNCER')).not.toThrow();
    });

    it('blocks pilot + target judge in the same competition', () => {
      expect(() => assertPilotJudgePolicy(['PILOT'], 'TARGET_JUDGE')).toThrow(AppError);
      expect(() => assertPilotJudgePolicy(['CHIEF_JUDGE'], 'PILOT')).toThrow(AppError);
    });

    it('maps official labels to competition roles', () => {
      expect(mapOfficialLabelToRole('Chief Judge')).toBe('CHIEF_JUDGE');
      expect(mapOfficialLabelToRole('Target Judge')).toBe('TARGET_JUDGE');
      expect(mapOfficialLabelToRole('Meet Director')).toBe('MEET_DIRECTOR');
      expect(mapOfficialLabelToRole('Scorekeeper')).toBe('SCORER');
    });
  });
});

vi.mock('../config/prisma.js', () => {
  const person = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const competitionParticipant = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const competitionParticipantRole = {
    create: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
  const pilot = { updateMany: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() };
  const competitionOfficial = { updateMany: vi.fn() };
  const user = { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() };
  const auditLog = { create: vi.fn() };
  const profileClaimRequest = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const personMergeLog = { create: vi.fn() };
  const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      person,
      competitionParticipant,
      competitionParticipantRole,
      pilot,
      competitionOfficial,
      user,
      profileClaimRequest,
      personMergeLog,
    }),
  );

  return {
    prisma: {
      person,
      competitionParticipant,
      competitionParticipantRole,
      pilot,
      competitionOfficial,
      user,
      auditLog,
      profileClaimRequest,
      personMergeLog,
      $transaction,
    },
  };
});

import { prisma } from '../config/prisma.js';
import {
  createPerson,
  getPublicProfile,
  matchPersons,
  mergePersons,
  requestProfileClaim,
} from '../services/person.service.js';

describe('person.service matching & privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches CIVL ID as EXACT and does not auto-merge names', async () => {
    (prisma.person.findFirst as ReturnType<typeof vi.fn>).mockImplementation(
      async (args: { where?: { civlId?: string; aeroJudgeId?: string } }) => {
        if (args.where?.civlId === '97253') {
          return {
            id: 'p1',
            aeroJudgeId: 'AJ-TEST01',
            firstName: 'Pratap',
            lastName: 'Sharma',
            middleName: null,
            preferredName: null,
            displayName: null,
            gender: 'MALE',
            nationalityCountryId: null,
            photoUrl: null,
            civlId: '97253',
            faiLicenseNumber: null,
            visibility: 'PRIVATE',
            status: 'ACTIVE',
            nationalityCountry: null,
          };
        }
        return null;
      },
    );
    (prisma.person.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'p2',
        aeroJudgeId: 'AJ-OTHER',
        firstName: 'Pratap',
        lastName: 'Sharma',
        middleName: null,
        preferredName: null,
        displayName: null,
        gender: 'MALE',
        nationalityCountryId: null,
        photoUrl: null,
        civlId: null,
        faiLicenseNumber: null,
        visibility: 'PRIVATE',
        status: 'ACTIVE',
        nationalityCountry: null,
      },
    ]);

    const byCivl = await matchPersons({ civlId: '97253' });
    expect(byCivl[0]?.confidence).toBe('EXACT');
    expect(byCivl[0]?.person.aeroJudgeId).toBe('AJ-TEST01');

    const byName = await matchPersons({ firstName: 'Pratap', lastName: 'Sharma' });
    expect(byName.every((m) => m.confidence === 'POSSIBLE')).toBe(true);
  });

  it('rejects duplicate CIVL on create', async () => {
    (prisma.person.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'existing',
      aeroJudgeId: 'AJ-EXIST',
      civlId: '111',
      status: 'ACTIVE',
    });
    // matchPersons short-circuits via exact — forceCreate still checks civl
    await expect(
      createPerson({
        firstName: 'A',
        lastName: 'B',
        civlId: '111',
        forceCreate: true,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('creates person without a user account', async () => {
    (prisma.person.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.person.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.person.create as ReturnType<typeof vi.fn>).mockImplementation(async ({ data }) => ({
      id: 'new-person',
      ...data,
      middleName: null,
      preferredName: null,
      displayName: null,
      dateOfBirth: null,
      nationalityCountryId: null,
      photoUrl: null,
      faiLicenseExpiry: null,
      email: null,
      emailVerifiedAt: null,
      phone: null,
      status: 'ACTIVE',
      mergedIntoId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      nationalityCountry: null,
    }));
    (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const person = await createPerson({
      firstName: 'Local',
      lastName: 'Volunteer',
      forceCreate: true,
    });
    expect(person.id).toBe('new-person');
    expect(person.aeroJudgeId).toMatch(/^AJ-/);
    // No User model interaction required
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('public profile excludes private contact fields', async () => {
    (prisma.person.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'p1',
      aeroJudgeId: 'AJ-PUBLIC',
      firstName: 'Public',
      lastName: 'Pilot',
      preferredName: null,
      displayName: null,
      photoUrl: null,
      civlId: '99',
      email: 'secret@example.com',
      phone: '999',
      status: 'ACTIVE',
      visibility: 'PUBLIC',
      nationalityCountry: { code: 'NPL', name: 'Nepal' },
    });
    (prisma.competitionParticipant.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const profile = await getPublicProfile('AJ-PUBLIC');
    expect(profile.aeroJudgeId).toBe('AJ-PUBLIC');
    expect(profile).not.toHaveProperty('email');
    expect(profile).not.toHaveProperty('phone');
    expect((profile as { email?: string }).email).toBeUndefined();
  });

  it('profile claim requests stay PENDING (no insecure auto-claim)', async () => {
    (prisma.person.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'p1',
      status: 'ACTIVE',
      aeroJudgeId: 'AJ-1',
      firstName: 'A',
      lastName: 'B',
      middleName: null,
      preferredName: null,
      displayName: null,
      gender: 'MALE',
      nationalityCountryId: null,
      photoUrl: null,
      civlId: null,
      faiLicenseNumber: null,
      visibility: 'PRIVATE',
      nationalityCountry: null,
      user: null,
    });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'u1',
      personId: null,
    });
    (prisma.profileClaimRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.profileClaimRequest.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'claim1',
      status: 'PENDING',
      personId: 'p1',
      userId: 'u1',
    });
    (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const claim = await requestProfileClaim('p1', 'u1', 'ORGANIZER_APPROVAL');
    expect(claim.status).toBe('PENDING');
  });

  it('merge moves relationships without destroying person ids (canonical retained)', async () => {
    (prisma.person.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'canonical',
      aeroJudgeId: 'AJ-CAN',
      civlId: '1',
      firstName: 'A',
      lastName: 'B',
      status: 'ACTIVE',
      faiLicenseNumber: null,
      email: null,
      phone: null,
      photoUrl: null,
      nationalityCountryId: null,
      dateOfBirth: null,
      middleName: null,
      preferredName: null,
      displayName: null,
      gender: 'MALE',
      visibility: 'PRIVATE',
      nationalityCountry: null,
      user: null,
    });
    (prisma.person.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'duplicate',
      aeroJudgeId: 'AJ-DUP',
      civlId: null,
      status: 'ACTIVE',
      faiLicenseNumber: null,
      email: null,
      phone: null,
      photoUrl: null,
      nationalityCountryId: null,
      dateOfBirth: null,
    });
    (prisma.pilot.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (prisma.competitionOfficial.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 0,
    });
    (prisma.competitionParticipant.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.user.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    (prisma.profileClaimRequest.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 0,
    });
    (prisma.person.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.personMergeLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    // second getPerson after merge
    (prisma.person.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        id: 'canonical',
        aeroJudgeId: 'AJ-CAN',
        civlId: '1',
        firstName: 'A',
        lastName: 'B',
        status: 'ACTIVE',
        faiLicenseNumber: null,
        email: null,
        phone: null,
        photoUrl: null,
        nationalityCountryId: null,
        dateOfBirth: null,
        middleName: null,
        preferredName: null,
        displayName: null,
        gender: 'MALE',
        visibility: 'PRIVATE',
        nationalityCountry: null,
        user: null,
      })
      .mockResolvedValueOnce({
        id: 'canonical',
        aeroJudgeId: 'AJ-CAN',
        civlId: '1',
        firstName: 'A',
        lastName: 'B',
        status: 'ACTIVE',
        faiLicenseNumber: null,
        email: null,
        phone: null,
        photoUrl: null,
        nationalityCountryId: null,
        dateOfBirth: null,
        middleName: null,
        preferredName: null,
        displayName: null,
        gender: 'MALE',
        visibility: 'PRIVATE',
        nationalityCountry: null,
        user: null,
      });

    const result = await mergePersons('canonical', 'duplicate', 'admin');
    expect(result.id).toBe('canonical');
    expect(prisma.person.update).toHaveBeenCalled();
  });
});
