import { parseCsvLine } from '@npha/utils';
import { ScoringEngine } from '@npha/scoring-engine';
import type { ScoreResultType } from '@npha/shared';
import {
  FlightStatus,
  RoundStatus,
  RoundType,
  FlightOrderType,
  ScoreStatus,
  type Prisma,
} from '@npha/database';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { getCompetition, settingsToRuleOverrides } from './competition.service.js';
import { recalculateRankings } from './scoring.service.js';

export interface ScoreImportResult {
  format: 'wide' | 'long';
  roundsDetected: number[];
  roundsCreated: number[];
  scoresUpserted: number;
  rowsProcessed: number;
  skipped: { pilotNumber: number; round?: number; reason: string }[];
  unknownPilots: number[];
}

type ParsedCell = {
  resultType: ScoreResultType;
  distanceCm: number | null;
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/['’]/g, '').replace(/[\s_\-]+/g, '');
}

function parseScoreCell(raw: string, maxCm: number): ParsedCell | null {
  const cell = raw.trim();
  if (!cell) return null;

  const upper = cell.toUpperCase();
  if (upper === 'DNF') return { resultType: 'DNF', distanceCm: null };
  if (upper === 'DNS') return { resultType: 'DNS', distanceCm: null };
  if (upper === 'ABS') return { resultType: 'ABS', distanceCm: null };
  if (upper === 'DQF' || upper === 'DSQ') return { resultType: 'DSQ', distanceCm: null };
  if (upper === 'REFLIGHT' || upper === 'RF') return { resultType: 'REFLIGHT', distanceCm: null };

  const n = Number.parseFloat(cell.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) {
    throw AppError.badRequest(`Invalid score value: ${raw}`);
  }
  if (n === 0) return { resultType: 'BULLSEYE', distanceCm: 0 };
  if (n >= maxCm) return { resultType: 'MAXIMUM', distanceCm: maxCm };
  return { resultType: 'MEASURED', distanceCm: n };
}

function detectPilotColumn(headers: string[]): number {
  const aliases = new Set([
    'pilotnumber',
    'pilotsid',
    'pilotid',
    'pilotno',
    'pilot#',
    'number',
    'bib',
    '#',
  ]);
  const idx = headers.findIndex((h) => aliases.has(h));
  if (idx < 0) {
    throw AppError.badRequest(
      'CSV must include a pilot number column (e.g. pilotNumber, Pilot\'s ID, or Pilot ID)',
    );
  }
  return idx;
}

function detectRoundColumns(headers: string[]): { index: number; roundNumber: number }[] {
  const rounds: { index: number; roundNumber: number }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    let m = /^round(\d+)$/.exec(h);
    if (!m) m = /^r(\d+)$/.exec(h);
    if (m) {
      rounds.push({ index: i, roundNumber: Number.parseInt(m[1], 10) });
    }
  }
  return rounds.sort((a, b) => a.roundNumber - b.roundNumber);
}

function isLongFormat(headers: string[]): boolean {
  const hasRound = headers.some((h) => h === 'round' || h === 'roundnumber' || h === 'roundno');
  const hasScore = headers.some(
    (h) => h === 'score' || h === 'scorecm' || h === 'distance' || h === 'distancecm' || h === 'result',
  );
  return hasRound && hasScore;
}

function detectLongColumns(headers: string[]): {
  pilotIdx: number;
  roundIdx: number;
  scoreIdx: number;
} {
  const pilotIdx = detectPilotColumn(headers);
  const roundIdx = headers.findIndex((h) => h === 'round' || h === 'roundnumber' || h === 'roundno');
  const scoreIdx = headers.findIndex(
    (h) => h === 'score' || h === 'scorecm' || h === 'distance' || h === 'distancecm' || h === 'result',
  );
  if (roundIdx < 0 || scoreIdx < 0) {
    throw AppError.badRequest('Long CSV must include round and score columns');
  }
  return { pilotIdx, roundIdx, scoreIdx };
}

async function ensureOfficialRound(competitionId: string, number: number) {
  const existing = await prisma.round.findFirst({
    where: { competitionId, number, type: RoundType.OFFICIAL },
  });
  if (existing) return { round: existing, created: false };

  const round = await prisma.round.create({
    data: {
      competitionId,
      number,
      name: `Round ${number}`,
      type: RoundType.OFFICIAL,
      status: RoundStatus.CLOSED,
      orderType: FlightOrderType.RANDOM,
      startedAt: new Date(),
      closedAt: new Date(),
    },
  });
  return { round, created: true };
}

async function ensureFlights(
  roundId: string,
  pilots: { id: string }[],
): Promise<Map<string, string>> {
  const existing = await prisma.flight.findMany({
    where: { roundId },
    select: { id: true, pilotId: true, flightOrder: true },
  });
  const byPilot = new Map(existing.map((f) => [f.pilotId, f.id]));
  let order = existing.reduce((m, f) => Math.max(m, f.flightOrder), 0);

  for (const pilot of pilots) {
    if (byPilot.has(pilot.id)) continue;
    order += 1;
    const created = await prisma.flight.create({
      data: {
        roundId,
        pilotId: pilot.id,
        flightOrder: order,
        status: FlightStatus.PENDING,
      },
    });
    byPilot.set(pilot.id, created.id);
  }
  return byPilot;
}

function flightStatusFor(resultType: ScoreResultType): FlightStatus {
  if (resultType === 'DNF') return FlightStatus.DNF;
  if (resultType === 'DNS') return FlightStatus.DNS;
  if (resultType === 'ABS') return FlightStatus.ABS;
  if (resultType === 'DSQ') return FlightStatus.DSQ;
  if (resultType === 'REFLIGHT') return FlightStatus.REFLIGHT;
  return FlightStatus.SCORED;
}

/**
 * Import scores from CSV.
 *
 * Wide format (overall sheet / PDF export):
 *   pilotNumber,Round 1,Round 2,...  (Rank/Team/Name/Gender/Total ignored)
 *
 * Long format:
 *   pilotNumber,round,score
 *
 * Score cells: numeric cm, or DNF / DNS / ABS / DSQ / DQF. Empty = skip.
 */
export async function importScoresFromCsv(
  competitionId: string,
  csvContent: string,
  opts: { enteredById: string },
): Promise<ScoreImportResult> {
  const competition = await getCompetition(competitionId);
  const rules = ScoringEngine.resolveRules(
    competition.ruleSet,
    settingsToRuleOverrides(competition.settings ?? undefined),
  );
  const maxCm = rules.maximumScoreCm;

  const lines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw AppError.badRequest('CSV must include a header row and at least one data row');
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const skipped: ScoreImportResult['skipped'] = [];
  const unknownPilots = new Set<number>();
  const roundsCreated: number[] = [];

  const pilots = await prisma.pilot.findMany({
    where: { competitionId },
    select: { id: true, pilotNumber: true },
  });
  const pilotByNumber = new Map(pilots.map((p) => [p.pilotNumber, p]));

  type Entry = { pilotNumber: number; roundNumber: number; cell: string };
  const entries: Entry[] = [];

  let format: 'wide' | 'long' = 'wide';
  let roundsDetected: number[] = [];

  if (isLongFormat(headers)) {
    format = 'long';
    const cols = detectLongColumns(headers);
    const roundNums = new Set<number>();
    for (let i = 1; i < lines.length; i++) {
      const colsRow = parseCsvLine(lines[i]);
      const pilotNumber = Number.parseInt(colsRow[cols.pilotIdx] ?? '', 10);
      const roundNumber = Number.parseInt(colsRow[cols.roundIdx] ?? '', 10);
      const cell = colsRow[cols.scoreIdx] ?? '';
      if (!Number.isFinite(pilotNumber) || !Number.isFinite(roundNumber)) {
        skipped.push({
          pilotNumber: Number.isFinite(pilotNumber) ? pilotNumber : 0,
          reason: `Invalid pilot/round on row ${i + 1}`,
        });
        continue;
      }
      if (!cell.trim()) continue;
      roundNums.add(roundNumber);
      entries.push({ pilotNumber, roundNumber, cell });
    }
    roundsDetected = [...roundNums].sort((a, b) => a - b);
  } else {
    const pilotIdx = detectPilotColumn(headers);
    const roundCols = detectRoundColumns(headers);
    if (roundCols.length === 0) {
      throw AppError.badRequest(
        'CSV must include Round columns (Round 1, Round 2, …) or use long format (pilotNumber,round,score)',
      );
    }
    roundsDetected = roundCols.map((r) => r.roundNumber);
    for (let i = 1; i < lines.length; i++) {
      const colsRow = parseCsvLine(lines[i]);
      const pilotNumber = Number.parseInt(colsRow[pilotIdx] ?? '', 10);
      if (!Number.isFinite(pilotNumber)) {
        skipped.push({ pilotNumber: 0, reason: `Invalid pilot number on row ${i + 1}` });
        continue;
      }
      for (const rc of roundCols) {
        const cell = colsRow[rc.index] ?? '';
        if (!cell.trim()) continue;
        entries.push({ pilotNumber, roundNumber: rc.roundNumber, cell });
      }
    }
  }

  if (entries.length === 0) {
    throw AppError.badRequest('No score cells found to import');
  }

  // Group by round for efficient flight creation
  const byRound = new Map<number, Entry[]>();
  for (const e of entries) {
    const list = byRound.get(e.roundNumber) ?? [];
    list.push(e);
    byRound.set(e.roundNumber, list);
  }

  let scoresUpserted = 0;
  const now = new Date();

  for (const roundNumber of [...byRound.keys()].sort((a, b) => a - b)) {
    const { round, created } = await ensureOfficialRound(competitionId, roundNumber);
    if (created) roundsCreated.push(roundNumber);

    if (round.status === 'LOCKED' || round.status === 'APPROVED') {
      for (const e of byRound.get(roundNumber) ?? []) {
        skipped.push({
          pilotNumber: e.pilotNumber,
          round: roundNumber,
          reason: `Round ${roundNumber} is ${round.status.toLowerCase()}`,
        });
      }
      continue;
    }

    // Soft-open closed rounds for import corrections, then leave CLOSED.
    if (['SCHEDULED', 'BRIEFING'].includes(round.status)) {
      await prisma.round.update({
        where: { id: round.id },
        data: {
          status: RoundStatus.CLOSED,
          startedAt: round.startedAt ?? now,
          closedAt: now,
        },
      });
    }

    const flightByPilot = await ensureFlights(round.id, pilots);
    const roundEntries = byRound.get(roundNumber) ?? [];

    for (const e of roundEntries) {
      const pilot = pilotByNumber.get(e.pilotNumber);
      if (!pilot) {
        unknownPilots.add(e.pilotNumber);
        skipped.push({
          pilotNumber: e.pilotNumber,
          round: roundNumber,
          reason: 'Pilot not registered in this competition',
        });
        continue;
      }

      let parsed: ParsedCell;
      try {
        const cell = parseScoreCell(e.cell, maxCm);
        if (!cell) continue;
        parsed = cell;
      } catch (err) {
        skipped.push({
          pilotNumber: e.pilotNumber,
          round: roundNumber,
          reason: err instanceof Error ? err.message : 'Invalid score',
        });
        continue;
      }

      const flightId = flightByPilot.get(pilot.id);
      if (!flightId) {
        skipped.push({
          pilotNumber: e.pilotNumber,
          round: roundNumber,
          reason: 'Missing flight',
        });
        continue;
      }

      const computed = ScoringEngine.computeFlightScore(
        {
          pilotId: pilot.id,
          roundId: round.id,
          distanceCm: parsed.distanceCm,
          resultType: parsed.resultType,
          penaltyCm: 0,
          isReflight: false,
        },
        rules,
      );

      const status = flightStatusFor(parsed.resultType);
      await prisma.flight.update({
        where: { id: flightId },
        data: {
          status,
          launchedAt: now,
          landedAt: status === FlightStatus.SCORED ? now : null,
        },
      });

      const scoreData: Prisma.ScoreUncheckedCreateInput = {
        flightId,
        roundId: round.id,
        pilotId: pilot.id,
        distanceCm: parsed.distanceCm,
        resultType: parsed.resultType,
        penaltyCm: 0,
        finalScoreCm: computed.finalScoreCm,
        isBullseye: computed.isBullseye,
        status: ScoreStatus.CONFIRMED,
        enteredById: opts.enteredById,
        enteredAt: now,
        confirmedAt: now,
        judgeNotes: 'Imported from CSV',
      };

      await prisma.score.upsert({
        where: { flightId },
        create: scoreData,
        update: {
          distanceCm: scoreData.distanceCm,
          resultType: scoreData.resultType,
          penaltyCm: 0,
          finalScoreCm: scoreData.finalScoreCm,
          isBullseye: scoreData.isBullseye,
          status: ScoreStatus.CONFIRMED,
          enteredById: opts.enteredById,
          enteredAt: now,
          confirmedAt: now,
          judgeNotes: 'Imported from CSV',
          version: { increment: 1 },
        },
      });
      scoresUpserted += 1;
    }
  }

  await recalculateRankings(competitionId);

  return {
    format,
    roundsDetected,
    roundsCreated,
    scoresUpserted,
    rowsProcessed: lines.length - 1,
    skipped,
    unknownPilots: [...unknownPilots].sort((a, b) => a - b),
  };
}
