import { randomBytes } from 'node:crypto';
import type { AuthTokens, AuthUser } from '@npha/shared';
import { prisma } from '../config/prisma.js';
import { accessTokenExpiresInSeconds, signAccessToken, signRefreshToken, verifyRefreshToken } from '../auth/jwt.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { AppError } from '../utils/errors.js';

export async function login(
  email: string,
  password: string,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.status !== 'ACTIVE') {
    throw AppError.unauthorized('Invalid email or password');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw AppError.unauthorized('Invalid email or password');
  }

  const tokenId = randomBytes(16).toString('hex');
  const refreshToken = signRefreshToken(user.id, tokenId);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.refreshToken.create({
      data: {
        token: tokenId,
        userId: user.id,
        expiresAt,
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
  ]);

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };

  return {
    user: authUser,
    tokens: {
      accessToken: signAccessToken(authUser),
      refreshToken,
      expiresIn: accessTokenExpiresInSeconds(),
    },
  };
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const payload = verifyRefreshToken(refreshToken);
  const stored = await prisma.refreshToken.findFirst({
    where: { token: payload.tokenId, userId: payload.sub, revokedAt: null },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date() || stored.user.status !== 'ACTIVE') {
    throw AppError.unauthorized('Refresh token invalid or expired');
  }

  const authUser: AuthUser = {
    id: stored.user.id,
    email: stored.user.email,
    firstName: stored.user.firstName,
    lastName: stored.user.lastName,
    role: stored.user.role,
    avatarUrl: stored.user.avatarUrl,
  };

  return {
    accessToken: signAccessToken(authUser),
    refreshToken,
    expiresIn: accessTokenExpiresInSeconds(),
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

export async function getMe(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'ACTIVE') {
    throw AppError.notFound('User not found');
  }
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
}

export { hashPassword };
