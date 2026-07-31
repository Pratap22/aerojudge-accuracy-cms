import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationMemberService } from '../modules/organization/organization-member.service.js';

vi.mock('../config/prisma.js', () => {
  const member = {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  };
  const organization = { findUnique: vi.fn() };
  const user = { findUnique: vi.fn(), create: vi.fn() };
  return {
    prisma: {
      organizationMember: member,
      organization,
      user,
    },
  };
});

vi.mock('../services/auth.service.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
}));

import { prisma } from '../config/prisma.js';

describe('OrganizationMemberService', () => {
  const service = new OrganizationMemberService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invite when member already exists', async () => {
    (prisma.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'org-1' });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
    });
    (prisma.organizationMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'm1',
    });

    await expect(
      service.invite('org-1', { email: 'a@b.com', role: 'JUDGE' }, 'inviter'),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('blocks removing the last organization manager', async () => {
    (prisma.organizationMember.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'm1',
      role: 'ORGANIZATION_OWNER',
      status: 'ACTIVE',
      organizationId: 'org-1',
      customRole: null,
    });
    (prisma.organizationMember.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { role: 'ORGANIZATION_OWNER', customRole: null },
    ]);

    await expect(service.remove('org-1', 'm1')).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('deactivates non-manager members', async () => {
    (prisma.organizationMember.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'm2',
      role: 'JUDGE',
      status: 'ACTIVE',
      organizationId: 'org-1',
      customRole: null,
    });
    (prisma.organizationMember.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'm2',
      status: 'INACTIVE',
    });

    const result = await service.remove('org-1', 'm2');
    expect(result.status).toBe('INACTIVE');
  });
});
