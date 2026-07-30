import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken } from '../auth/jwt.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { hasPermission } from '@npha/shared';

describe('auth jwt', () => {
  it('signs and verifies access token', () => {
    const user = {
      id: 'user-1',
      email: 'judge@npha.org.np',
      firstName: 'Test',
      lastName: 'Judge',
      role: 'JUDGE' as const,
    };
    const token = signAccessToken(user);
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe(user.id);
    expect(payload.email).toBe(user.email);
    expect(payload.role).toBe('JUDGE');
  });

  it('signs and verifies refresh token', () => {
    const token = signRefreshToken('user-1', 'token-id-abc');
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.tokenId).toBe('token-id-abc');
  });
});

describe('auth password', () => {
  it('hashes and verifies password', async () => {
    const hash = await hashPassword('SecurePass123!');
    expect(hash).not.toBe('SecurePass123!');
    expect(await verifyPassword('SecurePass123!', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('rbac hasPermission', () => {
  it('allows judges to enter scores', () => {
    expect(hasPermission('JUDGE', 'score:enter')).toBe(true);
  });

  it('denies public users score entry', () => {
    expect(hasPermission('PUBLIC_USER', 'score:enter')).toBe(false);
  });

  it('allows super admin all checked permissions', () => {
    expect(hasPermission('SUPER_ADMIN', 'user:manage')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'competition:delete')).toBe(true);
  });
});

describe('AppError', () => {
  it('creates typed errors', async () => {
    const { AppError } = await import('../utils/errors.js');
    const err = AppError.notFound('Pilot not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });
});
