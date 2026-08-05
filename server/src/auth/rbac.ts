import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import {
  hasEffectivePermission,
  isPlatformRole,
  ORGANIZATION_HEADER,
  type Permission,
  type Role,
} from '@npha/shared';
import { verifyAccessToken } from './jwt.js';
import { AppError } from '../utils/errors.js';
import { prisma } from '../config/prisma.js';
import { resolveMembershipPermissions } from './permissions.js';

function attachUserFromPayload(
  req: Request,
  payload: ReturnType<typeof verifyAccessToken>,
): void {
  req.user = {
    id: payload.sub,
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    role: payload.role,
    organizationId: payload.organizationId,
    orgRole: payload.orgRole,
  };
}

/**
 * Requires a valid Bearer access token and populates req.user.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(AppError.unauthorized('Missing or invalid Authorization header'));
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice(7));
    attachUserFromPayload(req, payload);
    next();
  } catch (err) {
    next(err);
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice(7));
    attachUserFromPayload(req, payload);
  } catch {
    // Ignore invalid token for optional auth
  }
  next();
}

/**
 * Resolves and validates organization context from X-Organization-Id (preferred)
 * or legacy JWT claim. Loads membership + effective permissions from the database.
 * Header-first enables multiple browser tabs with different organizations.
 */
export async function resolveOrganizationContext(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    next(AppError.unauthorized());
    return;
  }

  const headerRaw = req.headers[ORGANIZATION_HEADER];
  const headerOrgId = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  // Prefer header (per-tab) over JWT claim (shared across tabs)
  const organizationId = (headerOrgId || '').trim() || undefined;

  if (!organizationId) {
    req.organizationId = undefined;
    req.orgRole = undefined;
    req.permissions = undefined;
    req.membership = undefined;
    next();
    return;
  }

  try {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: req.user.id,
        },
      },
      include: {
        organization: { select: { id: true, status: true, isActive: true } },
        customRole: { select: { id: true, permissions: true, name: true } },
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      next(AppError.forbidden('Not a member of this organization'));
      return;
    }

    if (!membership.organization.isActive || membership.organization.status === 'ARCHIVED') {
      next(AppError.forbidden('Organization is not active'));
      return;
    }

    const permissions = resolveMembershipPermissions({
      role: membership.role,
      customRole: membership.customRole,
    });

    req.organizationId = membership.organizationId;
    req.orgRole = membership.role;
    req.permissions = permissions;
    req.membership = {
      id: membership.id,
      organizationId: membership.organizationId,
      userId: membership.userId,
      role: membership.role,
      status: membership.status,
      customRoleId: membership.customRoleId,
    };
    req.user.organizationId = membership.organizationId;
    req.user.orgRole = membership.role;
    req.user.permissions = permissions;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Requires an active organization context (membership validated).
 */
export function requireOrgContext(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(AppError.unauthorized());
    return;
  }
  if (!req.organizationId || !req.orgRole) {
    next(
      AppError.forbidden(
        'Organization context required. Select an organization or send X-Organization-Id.',
      ),
    );
    return;
  }
  next();
}

export function requireRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden(`Requires one of roles: ${roles.join(', ')}`));
      return;
    }
    next();
  };
}

/**
 * Requires a platform-level role (Platform Administrator / Support / Developer).
 */
export function requirePlatformRole(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(AppError.unauthorized());
    return;
  }
  if (!isPlatformRole(req.user.role)) {
    next(AppError.forbidden('Platform role required'));
    return;
  }
  next();
}

/**
 * Permission check preferring organization membership role over platform role.
 * Platform-only permissions still use platform role.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    // When an org is resolved, membership permissions are SSoT — never fall back
    // to legacy global User.role (prevents cross-tenant permission leakage).
    const orgResolved = Boolean(req.organizationId || req.orgRole || req.permissions);
    const allowed = hasEffectivePermission({
      platformRole: req.user.role,
      orgRole: req.orgRole ?? req.user.orgRole,
      permissions: req.permissions ?? req.user.permissions,
      permission,
      allowLegacyGlobalRole: !orgResolved,
    });
    if (!allowed) {
      // Structured denial for operators (safe fields only — never tokens/passwords).
      if (!env.isProduction) {
        console.warn(
          JSON.stringify({
            event: 'AUTHZ_DENIED',
            userId: req.user.id,
            organizationId: req.organizationId ?? null,
            requiredPermission: permission,
            platformRole: req.user.role,
            orgRole: req.orgRole ?? null,
            path: req.originalUrl,
          }),
        );
      }
      next(AppError.forbidden(`Missing permission: ${permission}`));
      return;
    }
    next();
  };
}

/**
 * Ensures the caller may act on the organization identified by a route param.
 *
 * Allows (without forcing a sidebar/org-header switch):
 * 1. Active org context already matching the param
 * 2. An ACTIVE membership on the target org (request context is switched to it)
 * 3. Platform operators with `platform:organizations`
 *
 * Downstream `requirePermission(...)` checks then evaluate against the target org
 * (or platform-granted org permissions), not the previously selected sidebar org.
 */
export function requireOrgMatchesParam(paramName = 'id') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }

    const targetId = req.params[paramName];
    if (!targetId) {
      next(AppError.badRequest('Organization id required'));
      return;
    }

    // Already scoped to this organization via X-Organization-Id / JWT
    if (req.organizationId === targetId) {
      next();
      return;
    }

    try {
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: targetId,
            userId: req.user.id,
          },
        },
        include: {
          organization: { select: { id: true, status: true, isActive: true } },
          customRole: { select: { id: true, permissions: true, name: true } },
        },
      });

      if (
        membership &&
        membership.status === 'ACTIVE' &&
        membership.organization.isActive &&
        membership.organization.status !== 'ARCHIVED'
      ) {
        const permissions = resolveMembershipPermissions({
          role: membership.role,
          customRole: membership.customRole,
        });
        req.organizationId = membership.organizationId;
        req.orgRole = membership.role;
        req.permissions = permissions;
        req.membership = {
          id: membership.id,
          organizationId: membership.organizationId,
          userId: membership.userId,
          role: membership.role,
          status: membership.status,
          customRoleId: membership.customRoleId,
        };
        req.user.organizationId = membership.organizationId;
        req.user.orgRole = membership.role;
        req.user.permissions = permissions;
        next();
        return;
      }

      // Platform operators can manage any tenant without switching the sidebar org
      if (
        hasEffectivePermission({
          platformRole: req.user.role,
          permission: 'platform:organizations',
          allowLegacyGlobalRole: false,
        })
      ) {
        const org = await prisma.organization.findUnique({
          where: { id: targetId },
          select: { id: true },
        });
        if (!org) {
          next(AppError.notFound('Organization not found'));
          return;
        }
        req.organizationId = targetId;
        req.orgRole = undefined;
        req.membership = undefined;
        // So requirePermission('organization:manage'|members|roles) succeeds for this request
        req.permissions = [
          'organization:read',
          'organization:manage',
          'organization:members',
          'organization:roles',
        ];
        req.user.organizationId = targetId;
        req.user.orgRole = undefined;
        req.user.permissions = req.permissions;
        next();
        return;
      }

      next(AppError.forbidden('You do not have access to perform this action on this organization'));
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Ensures a competition belongs to the current organization context.
 */
export async function requireCompetitionInOrg(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.organizationId) {
    next(AppError.forbidden('Organization context required'));
    return;
  }

  const competitionId =
    req.params.competitionId || req.params.id || (req.body as { competitionId?: string })?.competitionId;

  if (!competitionId) {
    next();
    return;
  }

  try {
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true, organizationId: true },
    });
    if (!competition) {
      next(AppError.notFound('Competition not found'));
      return;
    }
    if (competition.organizationId !== req.organizationId) {
      // Prefer not-found across tenants to avoid leaking resource existence.
      next(AppError.notFound('Competition not found'));
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
