import type { SignOptions } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
import type { Role } from '@npha/shared';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
  type: 'refresh';
}

function parseExpiresIn(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return 900;
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * (multipliers[unit] ?? 60);
}

export function signAccessToken(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    type: 'access',
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function signRefreshToken(userId: string, tokenId: string): string {
  const payload: RefreshTokenPayload = { sub: userId, tokenId, type: 'refresh' };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    if (payload.type !== 'access') throw AppError.unauthorized('Invalid token type');
    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.unauthorized('Invalid or expired access token');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    if (payload.type !== 'refresh') throw AppError.unauthorized('Invalid token type');
    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.unauthorized('Invalid or expired refresh token');
  }
}

export function accessTokenExpiresInSeconds(): number {
  return parseExpiresIn(env.JWT_ACCESS_EXPIRES_IN);
}
