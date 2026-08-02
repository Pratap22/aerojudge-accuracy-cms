import { describe, expect, it } from 'vitest';
import { estimateHoursSaved, estimateMinutesSaved, formatHoursSaved } from './time-saved';

describe('time-saved estimates', () => {
  it('scales with pilots and rounds', () => {
    // 33 pilots × 9 rounds × 3 min + 9 × 25 min = 891 + 225 = 1116 min ≈ 18.6 hrs
    expect(estimateMinutesSaved(33, 9)).toBe(1116);
    expect(estimateHoursSaved(33, 9)).toBe(18.6);
  });

  it('handles zeros', () => {
    expect(estimateHoursSaved(0, 0)).toBe(0);
    expect(formatHoursSaved(0)).toBe('0 hrs');
  });

  it('formats under one hour as minutes', () => {
    expect(formatHoursSaved(0.5)).toBe('30 min');
  });
});
