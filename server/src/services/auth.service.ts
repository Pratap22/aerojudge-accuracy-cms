import { randomBytes } from 'node:crypto';
import type {
  AuthOrganizationMembership,
  AuthTokens,
  AuthUser,
  LoginResult,
  OrgRole,
  Permission,
} from '@npha/shared';
import { prisma } from '../config/prisma.js';
import {
  accessTokenExpiresInSeconds,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type AccessTokenUser,
} from '../auth/jwt.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { resolveMembershipPermissions } from '../auth/permissions.js';
import { AppError } from '../utils/errors.js';
import { toAbsoluteAssetUrl } from '../utils/assets.js';

function toAuthUser(
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: AuthUser['role'];
    avatarUrl?: string | null;
    personId?: string | null;
  },
  ctx?: {
    organizationId?: string | null;
    orgRole?: OrgRole | null;
    permissions?: Permission[] | null;
  },
  organizations?: AuthOrganizationMembership[],
  person?: AuthUser['person'],
): AuthUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    organizationId: ctx?.organizationId ?? null,
    orgRole: ctx?.orgRole ?? null,
    permissions: ctx?.permissions ?? undefined,
    organizations,
    personId: user.personId ?? person?.id ?? null,
    person: person ?? null,
  };
}

async function loadPersonSummary(personId: string | null | undefined): Promise<AuthUser['person']> {
  if (!personId) return null;
  const person = await prisma.person.findFirst({
    where: { id: personId, status: { not: 'MERGED' } },
    include: {
      nationalityCountry: {
        select: { id: true, code: true, code2: true, name: true },
      },
    },
  });
  if (!person) return null;
  return {
    id: person.id,
    aeroJudgeId: person.aeroJudgeId,
    firstName: person.firstName,
    lastName: person.lastName,
    middleName: person.middleName,
    preferredName: person.preferredName,
    displayName: person.displayName,
    gender: person.gender,
    civlId: person.civlId,
    faiLicenseNumber: person.faiLicenseNumber,
    photoUrl: person.photoUrl,
    nationalityCountryId: person.nationalityCountryId,
    nationalityCountry: person.nationalityCountry,
  };
}

/** Identity-only token user — org context lives in X-Organization-Id per tab. */
function toTokenUser(user: AuthUser): AccessTokenUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  };
}

/**
 * Lists active organization memberships for a user (with permission bundles).
 */
export async function listUserOrganizations(
  userId: string,
): Promise<AuthOrganizationMembership[]> {
  const members = await prisma.organizationMember.findMany({
    where: {
      userId,
      status: { in: ['ACTIVE', 'INVITED'] },
      organization: { isActive: true, status: { not: 'ARCHIVED' } },
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          shortName: true,
          slug: true,
          logoUrl: true,
        },
      },
      customRole: { select: { id: true, name: true, permissions: true } },
    },
    orderBy: { organization: { name: 'asc' } },
  });

  return members.map((m) => {
    const permissions = resolveMembershipPermissions({
      role: m.role,
      customRole: m.customRole,
    });
    return {
      id: m.id,
      organizationId: m.organization.id,
      name: m.organization.name,
      shortName: m.organization.shortName,
      slug: m.organization.slug,
      logoUrl: toAbsoluteAssetUrl(m.organization.logoUrl),
      role: m.role,
      customRoleId: m.customRoleId,
      customRoleName: m.customRole?.name ?? null,
      permissions,
      status: m.status,
    };
  });
}

async function issueTokens(
  user: AccessTokenUser,
  meta?: { userAgent?: string; ipAddress?: string },
  options?: { createRefresh?: boolean },
): Promise<AuthTokens> {
  const createRefresh = options?.createRefresh !== false;
  let refreshToken: string;

  if (createRefresh) {
    const tokenId = randomBytes(16).toString('hex');
    refreshToken = signRefreshToken(user.id, tokenId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: {
        token: tokenId,
        userId: user.id,
        expiresAt,
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
      },
    });
  } else {
    refreshToken = '';
  }

  return {
    accessToken: signAccessToken(user),
    refreshToken,
    expiresIn: accessTokenExpiresInSeconds(),
  };
}

/**
 * Authenticates with email/password and returns org memberships for selection.
 */
export async function login(
  email: string,
  password: string,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.status !== 'ACTIVE') {
    throw AppError.unauthorized('Invalid email or password');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw AppError.unauthorized('Invalid email or password');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const organizations = await listUserOrganizations(user.id);
  const activeOrgs = organizations.filter((o) => o.status === 'ACTIVE');
  const requiresOrganizationSelection = activeOrgs.length > 1;

  let organizationId: string | null = null;
  let orgRole: OrgRole | null = null;
  let permissions: Permission[] | null = null;

  if (activeOrgs.length === 1) {
    organizationId = activeOrgs[0].organizationId;
    orgRole = activeOrgs[0].role;
    permissions = activeOrgs[0].permissions as Permission[];
    await prisma.organizationMember.update({
      where: { id: activeOrgs[0].id },
      data: { lastLoginAt: new Date() },
    });
  }

  // Identity-only access token — org context is per-tab via X-Organization-Id
  const person = await loadPersonSummary(user.personId);
  const authUser = toAuthUser(
    user,
    { organizationId, orgRole, permissions },
    organizations,
    person,
  );
  const tokens = await issueTokens(toTokenUser(authUser), meta, { createRefresh: true });

  return {
    user: authUser,
    tokens,
    organizations,
    requiresOrganizationSelection,
  };
}

/**
 * Creates a participant AeroJudge account (no organization membership required).
 * Links or creates a Person so the user has a reusable competition identity.
 */
export async function registerParticipant(
  input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  },
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<LoginResult> {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw AppError.conflict('An account with this email already exists. Sign in instead.');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      role: 'PUBLIC_USER',
      status: 'ACTIVE',
    },
  });

  // Prefer claim by email match to existing Person directory entry.
  let personId: string | null = null;
  const existingPerson = await prisma.person.findFirst({
    where: { email, status: 'ACTIVE' },
  });
  if (existingPerson) {
    const alreadyLinked = await prisma.user.findFirst({
      where: { personId: existingPerson.id, NOT: { id: user.id } },
    });
    if (!alreadyLinked) {
      personId = existingPerson.id;
      await prisma.person.update({
        where: { id: existingPerson.id },
        data: {
          emailVerifiedAt: new Date(),
          firstName: existingPerson.firstName || input.firstName.trim(),
          lastName: existingPerson.lastName || input.lastName.trim(),
        },
      });
    }
  }

  if (!personId) {
    const { createPerson } = await import('./person.service.js');
    const person = await createPerson(
      {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        forceCreate: true,
      },
      { actorUserId: user.id },
    );
    personId = person.id;
    await prisma.person.update({
      where: { id: personId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { personId, lastLoginAt: new Date() },
  });

  const linked = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const organizations = await listUserOrganizations(user.id);
  const person = await loadPersonSummary(personId);
  const authUser = toAuthUser(linked, {}, organizations, person);
  const tokens = await issueTokens(toTokenUser(authUser), meta, { createRefresh: true });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'PARTICIPANT_ACCOUNT_CREATED',
      entityType: 'User',
      entityId: user.id,
      afterJson: { personId, email },
    },
  });

  return {
    user: authUser,
    tokens,
    organizations,
    requiresOrganizationSelection: false,
  };
}

/**
 * Selects an organization for this client/tab. Access token stays identity-only
 * so other tabs can keep a different org context under the same session.
 */
export async function selectOrganization(
  userId: string,
  organizationId: string,
  existingRefreshToken?: string,
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'ACTIVE') {
    throw AppError.unauthorized();
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          shortName: true,
          slug: true,
          logoUrl: true,
          isActive: true,
          status: true,
        },
      },
      customRole: { select: { id: true, name: true, permissions: true } },
    },
  });

  if (!membership || membership.status !== 'ACTIVE') {
    throw AppError.forbidden('Not an active member of this organization');
  }
  if (!membership.organization.isActive || membership.organization.status === 'ARCHIVED') {
    throw AppError.forbidden('Organization is not active');
  }

  await prisma.organizationMember.update({
    where: { id: membership.id },
    data: { lastLoginAt: new Date() },
  });

  const organizations = await listUserOrganizations(userId);
  const permissions = resolveMembershipPermissions({
    role: membership.role,
    customRole: membership.customRole,
  });
  const authUser = toAuthUser(
    user,
    {
      organizationId: membership.organizationId,
      orgRole: membership.role,
      permissions,
    },
    organizations,
  );

  // Re-sign identity-only access token (no org claim) so multi-tab stays safe
  const accessToken = signAccessToken(toTokenUser(authUser));
  const tokens: AuthTokens = {
    accessToken,
    refreshToken: existingRefreshToken ?? '',
    expiresIn: accessTokenExpiresInSeconds(),
  };

  return {
    user: authUser,
    tokens,
    organizations,
    requiresOrganizationSelection: false,
  };
}

export async function refresh(
  refreshToken: string,
  organizationId?: string,
): Promise<AuthTokens & { user: AuthUser }> {
  const payload = verifyRefreshToken(refreshToken);
  const stored = await prisma.refreshToken.findFirst({
    where: { token: payload.tokenId, userId: payload.sub, revokedAt: null },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date() || stored.user.status !== 'ACTIVE') {
    throw AppError.unauthorized('Refresh token invalid or expired');
  }

  const organizations = await listUserOrganizations(stored.user.id);
  let orgId = organizationId;
  let orgRole: OrgRole | null = null;
  let permissions: Permission[] | null = null;

  if (orgId) {
    const membership = organizations.find(
      (o) => o.organizationId === orgId && o.status === 'ACTIVE',
    );
    if (!membership) {
      throw AppError.forbidden('Not an active member of this organization');
    }
    orgRole = membership.role;
    permissions = membership.permissions as Permission[];
  } else if (organizations.filter((o) => o.status === 'ACTIVE').length === 1) {
    const only = organizations.find((o) => o.status === 'ACTIVE')!;
    orgId = only.organizationId;
    orgRole = only.role;
    permissions = only.permissions as Permission[];
  }

  const person = await loadPersonSummary(stored.user.personId);
  const authUser = toAuthUser(
    stored.user,
    { organizationId: orgId ?? null, orgRole, permissions },
    organizations,
    person,
  );

  return {
    accessToken: signAccessToken(toTokenUser(authUser)),
    refreshToken,
    expiresIn: accessTokenExpiresInSeconds(),
    user: authUser,
  };
}

export async function logout(refreshToken: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { token: payload.tokenId, userId: payload.sub, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Idempotent logout
  }
}

export async function getMe(
  userId: string,
  organizationId?: string,
): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'ACTIVE') {
    throw AppError.notFound('User not found');
  }

  const organizations = await listUserOrganizations(userId);
  let orgRole: OrgRole | null = null;
  let permissions: Permission[] | null = null;
  let orgId = organizationId ?? null;

  if (orgId) {
    const membership = organizations.find(
      (o) => o.organizationId === orgId && o.status === 'ACTIVE',
    );
    if (membership) {
      orgRole = membership.role;
      permissions = membership.permissions as Permission[];
    } else {
      orgId = null;
    }
  }

  const person = await loadPersonSummary(user.personId);
  return toAuthUser(
    user,
    { organizationId: orgId, orgRole, permissions },
    organizations,
    person,
  );
}

export { hashPassword };
