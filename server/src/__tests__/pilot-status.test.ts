import { describe, expect, it } from 'vitest';
import { COMPETING_PILOT_STATUSES, PILOT_STATUSES, pilotStatusSchema } from '@npha/shared';

describe('pilot status workflow', () => {
  it('includes REJECTED in shared pilot statuses', () => {
    expect(PILOT_STATUSES).toContain('REJECTED');
    expect(pilotStatusSchema.safeParse('REJECTED').success).toBe(true);
    expect(pilotStatusSchema.safeParse('INVALID').success).toBe(false);
  });

  it('excludes pending and rejected from competing statuses', () => {
    expect(COMPETING_PILOT_STATUSES).toEqual(['CONFIRMED', 'CHECKED_IN', 'ACTIVE']);
    expect(COMPETING_PILOT_STATUSES).not.toContain('REGISTERED');
    expect(COMPETING_PILOT_STATUSES).not.toContain('REJECTED');
  });
});
