import { describe, it, expect } from 'vitest';
import { resolveMembershipPermissions } from '../auth/permissions.js';

describe('resolveMembershipPermissions', () => {
  it('uses built-in role bundle when no custom role', () => {
    const perms = resolveMembershipPermissions({ role: 'JUDGE' });
    expect(perms).toContain('score:enter');
    expect(perms).not.toContain('competition:delete');
  });

  it('prefers custom role permissions over built-in role', () => {
    const perms = resolveMembershipPermissions({
      role: 'VIEWER',
      customRole: {
        permissions: ['competition:create', 'score:approve_chief', 'results:publish'],
      },
    });
    expect(perms).toEqual([
      'competition:create',
      'score:approve_chief',
      'results:publish',
    ]);
  });
});
