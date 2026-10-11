import { describe, expect, it } from 'vitest';
import { resolveReportCellValue, type ResultRow } from './index';

const row: ResultRow = {
  rank: 1,
  pilotNumber: 2,
  name: 'Sample Pilot',
  scores: [],
  total: 0,
};

describe('resolveReportCellValue', () => {
  it('pads pilot numbers to three digits in report tables', () => {
    expect(resolveReportCellValue('No', row, { current: 0 }).text).toBe('002');
    expect(resolveReportCellValue('Pilot number', row, { current: 0 }).text).toBe('002');
    expect(resolveReportCellValue('Rank', row, { current: 0 }).text).toBe('1');
  });
});
