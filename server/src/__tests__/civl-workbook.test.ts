import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  INDIVIDUAL_BASE_HEADERS,
  TEAM_BASE_HEADERS,
  buildIndividualWorkbook,
  buildTeamWorkbook,
  civlGender,
  civlNationCode,
  civlPilotNumber,
  competitionRanks,
  type CivlPilotFields,
} from '../services/civl-workbook.js';

const pilot = (overrides: Partial<CivlPilotFields> = {}): CivlPilotFields => ({
  number: '006',
  firstName: 'Dushyant',
  lastName: 'Chandra',
  nat: 'IND',
  gender: 'M',
  wingManufacturer: '',
  wingModel: 'Rush 6',
  pgCertification: '',
  harnessManufacturer: '',
  harnessModel: 'Lightness 3',
  sponsor: 'Club',
  civlId: '12345',
  ...overrides,
});

async function sheetOf(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('missing sheet');
  return sheet;
}

function rowValues(sheet: ExcelJS.Worksheet, rowNumber: number): unknown[] {
  const row = sheet.getRow(rowNumber);
  const values: unknown[] = [];
  for (let column = 1; column <= sheet.columnCount; column += 1) {
    values.push(row.getCell(column).value);
  }
  return values;
}

describe('CIVL spreadsheet', () => {
  it('writes nation codes, gender, and zero-padded numbers the template expects', () => {
    expect(civlNationCode('idn')).toBe('INA');
    expect(civlNationCode('NPL')).toBe('NEP');
    expect(civlNationCode('IND')).toBe('IND');
    expect(civlNationCode('Nepal')).toBe('');
    expect(civlGender('FEMALE')).toBe('F');
    expect(civlGender('OTHER')).toBe('');
    expect(civlPilotNumber(6)).toBe('006');
    expect(competitionRanks([0, 0, 1, 1, 2])).toEqual([1, 1, 3, 3, 5]);
  });

  it('builds the individual sheet with shared ranks and round columns', async () => {
    const buffer = await buildIndividualWorkbook(
      [
        { ...pilot({ number: '029' }), rank: 1, score: 0, rounds: [0, 0] },
        { ...pilot({ number: '017', firstName: 'A' }), rank: 1, score: 0, rounds: [0, 0] },
        { ...pilot({ number: '003', firstName: 'B' }), rank: 3, score: 2, rounds: [1, 1] },
      ],
      ['Round 1', 'Round 2'],
    );
    const sheet = await sheetOf(buffer);
    expect(sheet.name).toBe('Individual Overall or Custom');
    expect(rowValues(sheet, 1)).toEqual([...INDIVIDUAL_BASE_HEADERS, 'Round 1', 'Round 2']);
    expect(rowValues(sheet, 2)[0]).toBe(1);
    expect(rowValues(sheet, 2)[1]).toBe('029');
    expect(rowValues(sheet, 3)[0]).toBe(1);
    expect(rowValues(sheet, 4)[0]).toBe(3);
    expect(rowValues(sheet, 4).slice(-3)).toEqual([2, 1, 1]);
  });

  it('merges the team rank, name, and score across its pilots', async () => {
    const buffer = await buildTeamWorkbook(
      [
        {
          rank: 1,
          name: 'SOL Team',
          score: 3,
          members: [
            { ...pilot({ number: '026' }), tasks: [2] },
            { ...pilot({ number: '029', firstName: 'Rizky' }), tasks: [0] },
          ],
        },
        {
          rank: 2,
          name: 'Sky Lords',
          score: 4,
          members: [{ ...pilot({ number: '017' }), tasks: [0] }],
        },
      ],
      ['T 1'],
    );
    const sheet = await sheetOf(buffer);
    expect(sheet.name).toBe('Group National or Teams');
    expect(rowValues(sheet, 1)).toEqual([...TEAM_BASE_HEADERS, 'T 1']);
    expect(rowValues(sheet, 2)[0]).toBe(1);
    expect(rowValues(sheet, 2)[1]).toBe('SOL Team');
    expect(rowValues(sheet, 2)[14]).toBe(3);
    expect(rowValues(sheet, 2)[15]).toBe(2);
    expect(rowValues(sheet, 3)[15]).toBe(0);
    expect(rowValues(sheet, 4)[0]).toBe(2);
    const merges = (sheet.model.merges ?? []).slice().sort();
    expect(merges).toEqual(['A2:A3', 'B2:B3', 'O2:O3']);
  });
});
