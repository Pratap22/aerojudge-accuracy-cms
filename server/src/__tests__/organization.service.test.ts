import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../utils/errors.js';
import { OrganizationService } from '../modules/organization/organization.service.js';
import type { OrganizationRepository } from '../modules/organization/organization.repository.js';
import { DEFAULT_ORGANIZATION_ID } from '../modules/organization/organization.types.js';

function mockRepo(overrides: Partial<OrganizationRepository> = {}): OrganizationRepository {
  return {
    findMany: vi.fn(),
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findDefaultActive: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    upsertSettings: vi.fn(),
    updateLogo: vi.fn(),
    countCompetitions: vi.fn(),
    findCompetitions: vi.fn(),
    archive: vi.fn(),
    ...overrides,
  } as unknown as OrganizationRepository;
}

describe('OrganizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws not found when organization missing', async () => {
    const repo = mockRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new OrganizationService(repo);
    await expect(service.getById('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });

  it('rejects duplicate slug on create', async () => {
    const repo = mockRepo({
      findBySlug: vi.fn().mockResolvedValue({ id: 'existing', slug: 'fai' }),
    });
    const service = new OrganizationService(repo);
    await expect(
      service.create({
        name: 'FAI',
        shortName: 'FAI',
        slug: 'fai',
        timezone: 'UTC',
        currency: 'USD',
        defaultRuleProfile: 'FAI_2022',
        plan: 'FREE',
        maxCompetitions: 10,
        maxUsers: 25,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('creates organization when slug is unique', async () => {
    const created = { id: 'org-1', slug: 'fai', name: 'FAI' };
    const repo = mockRepo({
      findBySlug: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(created),
      findById: vi.fn().mockResolvedValue(created),
    });
    const service = new OrganizationService(repo);
    const result = await service.create({
      name: 'FAI',
      shortName: 'FAI',
      slug: 'fai',
      timezone: 'UTC',
      currency: 'CHF',
      defaultRuleProfile: 'FAI_2022',
      plan: 'ENTERPRISE',
      maxCompetitions: 100,
      maxUsers: 500,
    });
    expect(result).toEqual(created);
    expect(repo.create).toHaveBeenCalledOnce();
  });

  it('resolves explicit organizationId when active', async () => {
    const repo = mockRepo({
      findById: vi.fn().mockResolvedValue({ id: 'org-2', isActive: true, status: 'ACTIVE' }),
    });
    const service = new OrganizationService(repo);
    await expect(service.resolveOrganizationId('org-2')).resolves.toBe('org-2');
  });

  it('rejects inactive organizationId', async () => {
    const repo = mockRepo({
      findById: vi.fn().mockResolvedValue({ id: 'org-2', isActive: false, status: 'INACTIVE' }),
    });
    const service = new OrganizationService(repo);
    await expect(service.resolveOrganizationId('org-2')).rejects.toBeInstanceOf(AppError);
  });

  it('falls back to default migration organization', async () => {
    const repo = mockRepo({
      findById: vi.fn().mockImplementation(async (id: string) =>
        id === DEFAULT_ORGANIZATION_ID
          ? { id: DEFAULT_ORGANIZATION_ID, isActive: true, status: 'ACTIVE' }
          : null,
      ),
    });
    const service = new OrganizationService(repo);
    await expect(service.resolveOrganizationId()).resolves.toBe(DEFAULT_ORGANIZATION_ID);
  });

  it('blocks hard delete when competitions exist', async () => {
    const repo = mockRepo({
      findById: vi.fn().mockResolvedValue({ id: 'org-1' }),
      countCompetitions: vi.fn().mockResolvedValue(3),
    });
    const service = new OrganizationService(repo);
    await expect(service.assertCanDelete('org-1')).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('allows assertCanDelete when no competitions', async () => {
    const repo = mockRepo({
      findById: vi.fn().mockResolvedValue({ id: 'org-1' }),
      countCompetitions: vi.fn().mockResolvedValue(0),
    });
    const service = new OrganizationService(repo);
    await expect(service.assertCanDelete('org-1')).resolves.toBeUndefined();
  });

  it('updates status via repository', async () => {
    const updated = { id: 'org-1', status: 'INACTIVE', isActive: false };
    const repo = mockRepo({
      findById: vi.fn().mockResolvedValue({ id: 'org-1', status: 'ACTIVE' }),
      updateStatus: vi.fn().mockResolvedValue(updated),
    });
    const service = new OrganizationService(repo);
    const result = await service.updateStatus('org-1', { status: 'INACTIVE' });
    expect(result.status).toBe('INACTIVE');
    expect(repo.updateStatus).toHaveBeenCalledWith('org-1', 'INACTIVE', undefined);
  });
});
