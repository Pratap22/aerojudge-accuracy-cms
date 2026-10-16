import ExcelJS from 'exceljs';

const INDIVIDUAL_SHEET = 'Individual Overall or Custom';
const TEAM_SHEET = 'Group National or Teams';

/** Headers match the CIVL individual template, including the trailing space on the wing model. */
export const INDIVIDUAL_BASE_HEADERS = [
  'Rank',
  'Number',
  'First Name',
  'Last Name',
  'Nat',
  'Gender',
  'Wing Manufacturer',
  'Wing model ',
  'PG Certification',
  'Harness Manufacturer',
  'Harness model',
  'Sponsor',
  'CIVL ID',
  'Score',
] as const;

/** Headers match the CIVL team template. Task columns such as "T 1" follow Score. */
export const TEAM_BASE_HEADERS = [
  'Rank',
  'Nation/Team',
  'Number',
  'First Name',
  'Last Name',
  'Nat',
  'Gender',
  'Wing Manufacturer',
  'Wing model ',
  'PG Certification ',
  'Harness Manufacturer',
  'Harness model',
  'Sponsor',
  'CIVL ID',
  'Score',
] as const;

export interface CivlPilotFields {
  number: string;
  firstName: string;
  lastName: string;
  nat: string;
  gender: string;
  wingManufacturer: string;
  wingModel: string;
  pgCertification: string;
  harnessManufacturer: string;
  harnessModel: string;
  sponsor: string;
  civlId: string;
}

export interface CivlIndividualRow extends CivlPilotFields {
  rank: number;
  score: number;
  /** One value per closed official round, in announced order. */
  rounds: number[];
}

export interface CivlTeamMember extends CivlPilotFields {
  /** One value per task column. Null when that pilot has no score for the task. */
  tasks: Array<number | null>;
}

export interface CivlTeamGroup {
  rank: number;
  name: string;
  score: number;
  members: CivlTeamMember[];
}

/** Nation column uses the same ISO alpha-3 code as the rest of the app. */
export function civlNationCode(code: string | null | undefined): string {
  const trimmed = code?.trim().toUpperCase() ?? '';
  return /^[A-Z]{3}$/.test(trimmed) ? trimmed : '';
}

export function civlGender(gender: string | null | undefined): string {
  if (gender === 'MALE') return 'M';
  if (gender === 'FEMALE') return 'F';
  return '';
}

/** CIVL number cells keep leading zeros, so 6 is written as 006. */
export function civlPilotNumber(pilotNumber: number | null | undefined): string {
  if (pilotNumber == null || !Number.isFinite(pilotNumber)) return '';
  return String(Math.trunc(pilotNumber)).padStart(3, '0');
}

/** Ties share a rank and the next rank skips ahead (1, 1, 1, 4). */
export function competitionRanks(totals: number[]): number[] {
  const ranks = new Array<number>(totals.length);
  let index = 0;
  while (index < totals.length) {
    let end = index + 1;
    while (end < totals.length && totals[end] === totals[index]) end += 1;
    const rank = index + 1;
    for (let cursor = index; cursor < end; cursor += 1) ranks[cursor] = rank;
    index = end;
  }
  return ranks;
}

export function individualHeaders(roundLabels: string[]): string[] {
  return [...INDIVIDUAL_BASE_HEADERS, ...roundLabels];
}

export function teamHeaders(taskLabels: string[]): string[] {
  return [...TEAM_BASE_HEADERS, ...taskLabels];
}

function styleHeader(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  header.eachCell((cell, col) => {
    const text = cell.value == null ? '' : String(cell.value);
    sheet.getColumn(col).width = Math.min(28, Math.max(12, text.length + 2));
  });
}

function pilotCells(pilot: CivlPilotFields): Array<string | number> {
  return [
    pilot.number,
    pilot.firstName,
    pilot.lastName,
    pilot.nat,
    pilot.gender,
    pilot.wingManufacturer,
    pilot.wingModel,
    pilot.pgCertification,
    pilot.harnessManufacturer,
    pilot.harnessModel,
    pilot.sponsor,
    pilot.civlId,
  ];
}

export async function buildIndividualWorkbook(
  rows: CivlIndividualRow[],
  roundLabels: string[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(INDIVIDUAL_SHEET);
  const headers = individualHeaders(roundLabels);
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow([row.rank, ...pilotCells(row), row.score, ...row.rounds]);
  }
  sheet.getColumn(2).numFmt = '@';
  styleHeader(sheet);
  return workbookBuffer(workbook);
}

export async function buildTeamWorkbook(
  groups: CivlTeamGroup[],
  taskLabels: string[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(TEAM_SHEET);
  sheet.addRow(teamHeaders(taskLabels));

  let rowNumber = 2;
  for (const group of groups) {
    const start = rowNumber;
    for (const member of group.members) {
      sheet.addRow([
        group.rank,
        group.name,
        ...pilotCells(member),
        group.score,
        ...member.tasks.map((task) => task ?? ''),
      ]);
      rowNumber += 1;
    }
    const end = rowNumber - 1;
    if (group.members.length > 1) {
      for (const column of [1, 2, 15]) {
        sheet.mergeCells(start, column, end, column);
        sheet.getCell(start, column).alignment = { vertical: 'middle' };
      }
    }
  }

  sheet.getColumn(3).numFmt = '@';
  styleHeader(sheet);
  return workbookBuffer(workbook);
}

async function workbookBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
}
