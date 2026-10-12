import { describe, expect, it } from 'vitest';
import { updateMaxRoundsSchema } from '@aero-judge/shared';
import { AppError } from '../utils/errors.js';
import { assertMaxRoundsAllowed } from '../services/competition.service.js';

describe('updateMaxRoundsSchema', () => {
  it('accepts a whole number from 1 to 30', () => {
    expect(updateMaxRoundsSchema.parse({ maxRounds: 12 })).toEqual({ maxRounds: 12 });
  });

  it('rejects a missing or out-of-range cap', () => {
    expect(updateMaxRoundsSchema.safeParse({}).success).toBe(false);
    expect(updateMaxRoundsSchema.safeParse({ maxRounds: 0 }).success).toBe(false);
    expect(updateMaxRoundsSchema.safeParse({ maxRounds: 31 }).success).toBe(false);
    expect(updateMaxRoundsSchema.safeParse({ maxRounds: 8.5 }).success).toBe(false);
  });
});

describe('assertMaxRoundsAllowed', () => {
  it('allows a cap at or above the official rounds already created', () => {
    expect(() => assertMaxRoundsAllowed(8, 8)).not.toThrow();
    expect(() => assertMaxRoundsAllowed(9, 3)).not.toThrow();
  });

  it('rejects a cap below the official rounds already created', () => {
    expect(() => assertMaxRoundsAllowed(7, 8)).toThrow(AppError);
    try {
      assertMaxRoundsAllowed(7, 8);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toMatch(/8 official rounds already created/);
    }
  });
});
