/**
 * Seed NPPL rounds 1–9 scores from official overall results CSV.
 * Run from repo root:
 *   npx tsx database/prisma/seed/seed-nppl-rounds-1-6.ts
 */
import {
  FlightStatus,
  PrismaClient,
  RoundStatus,
  RoundType,
  FlightOrderType,
  ScoreResultType,
  ScoreStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const MAX_CM = 500;
const ROUND_COUNT = 9;

type Cell = string;

/** pilotNumber → [R1…R9] from official overall sheet (R10–R12 empty). */
const SCORES: Record<number, Cell[]> = {
  30: ['005', '003', '002', '001', '001', '003', '001', '002', '001'],
  32: ['032', '020', '002', '021', '003', '003', '001', '004', '002'],
  10: ['001', '002', '000', '002', '246', '002', '033', '018', '002'],
  13: ['009', '001', '022', '004', '001', '123', '005', '006', '017'],
  9: ['017', '500', '039', '005', '005', '003', '011', '002', '006'],
  18: ['001', '022', '044', '005', '011', '003', '500', '002', '001'],
  11: ['092', '004', '500', '005', '005', '002', '008', '001', '083'],
  5: ['041', '007', '130', '026', '500', '006', '007', '052', '002'],
  25: ['004', '000', '006', '147', '011', '500', '060', '030', '225'],
  21: ['001', '003', '500', '009', '002', '001', '014', '037', '500'],
  22: ['019', '391', '148', '036', '104', '149', '102', '011', '058'],
  16: ['002', '000', '002', '477', '500', '008', '108', '000', '036'],
  1: ['500', '042', '049', '026', '095', '002', '001', '409', '046'],
  4: ['001', '002', '159', '000', '007', '070', '028', '500', '500'],
  31: ['003', '500', '007', '129', '086', '078', '500', '020', '007'],
  7: ['246', '500', '003', '009', '017', '006', '500', '005', '046'],
  3: ['500', '007', '226', '029', '011', '063', '500', '004', '031'],
  12: ['004', '009', '500', '003', '000', '002', '002', '500', '500'],
  27: ['028', '500', '014', '183', '078', '033', '008', '194', 'DNF'],
  15: ['500', '096', '009', '341', '019', '060', '037', '197', '453'],
  28: ['033', '005', '002', '022', '075', '129', 'DQF', 'DQF', 'DQF'],
  29: ['007', '020', '189', '500', '131', '005', '500', '006', '500'],
  19: ['040', '500', '201', '387', '074', '004', '500', '500', '004'],
  26: ['053', '049', '500', '019', '480', '213', '500', '500', '182'],
  24: ['500', '500', '158', '266', '473', '007', '066', '500', '119'],
  8: ['500', '006', '500', '500', 'DNF', 'DNF', '162', '107', '069'],
  23: ['500', '500', '150', '131', '362', '500', '196', '245', '500'],
  14: ['500', '500', '500', '257', '500', '069', '500', '500', '016'],
  17: ['249', '500', '500', '500', '500', '096', '500', '500', '308'],
  6: ['500', '088', '500', '500', '313', '500', 'DNF', 'DNF', 'DNF'],
  2: ['500', '500', '500', 'DNF', 'DNF', 'DNF', 'DNF', 'DNF', 'DNF'],
  20: ['DNF', 'DNF', 'DNF', 'DNF', 'DNF', 'DNF', 'DNF', 'DNF', 'DNF'],
  33: ['DNF', 'DNF', 'DNF', 'DNF', 'DNF', 'DNF', 'DNF', 'DNF', 'DNF'],
};

function parseCell(cell: Cell): {
  resultType: ScoreResultType;
  distanceCm: number | null;
  finalScoreCm: number;
  isBullseye: boolean;
  flightStatus: FlightStatus;
} {
  const raw = cell.trim().toUpperCase();
  if (raw === 'DNF') {
    return {
      resultType: ScoreResultType.DNF,
      distanceCm: null,
      finalScoreCm: MAX_CM,
      isBullseye: false,
      flightStatus: FlightStatus.DNF,
    };
  }
  if (raw === 'DQF' || raw === 'DSQ') {
    return {
      resultType: ScoreResultType.DSQ,
      distanceCm: null,
      finalScoreCm: MAX_CM,
      isBullseye: false,
      flightStatus: FlightStatus.DSQ,
    };
  }
  if (raw === 'DNS') {
    return {
      resultType: ScoreResultType.DNS,
      distanceCm: null,
      finalScoreCm: MAX_CM,
      isBullseye: false,
      flightStatus: FlightStatus.DNS,
    };
  }
  if (raw === 'ABS') {
    return {
      resultType: ScoreResultType.ABS,
      distanceCm: null,
      finalScoreCm: MAX_CM,
      isBullseye: false,
      flightStatus: FlightStatus.ABS,
    };
  }

  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) {
    throw new Error(`Unknown score cell: ${cell}`);
  }
  if (n === 0) {
    return {
      resultType: ScoreResultType.BULLSEYE,
      distanceCm: 0,
      finalScoreCm: 0,
      isBullseye: true,
      flightStatus: FlightStatus.SCORED,
    };
  }
  if (n >= MAX_CM) {
    return {
      resultType: ScoreResultType.MAXIMUM,
      distanceCm: MAX_CM,
      finalScoreCm: MAX_CM,
      isBullseye: false,
      flightStatus: FlightStatus.SCORED,
    };
  }
  return {
    resultType: ScoreResultType.MEASURED,
    distanceCm: n,
    finalScoreCm: n,
    isBullseye: false,
    flightStatus: FlightStatus.SCORED,
  };
}

async function ensureRound(
  competitionId: string,
  number: number,
  status: RoundStatus,
  startedAt: Date,
  closedAt: Date | null,
) {
  const existing = await prisma.round.findFirst({
    where: { competitionId, number, type: RoundType.OFFICIAL },
  });
  if (existing) {
    return prisma.round.update({
      where: { id: existing.id },
      data: {
        status,
        startedAt: existing.startedAt ?? startedAt,
        closedAt,
        name: existing.name || `Round ${number}`,
      },
    });
  }
  return prisma.round.create({
    data: {
      competitionId,
      number,
      name: `Round ${number}`,
      type: RoundType.OFFICIAL,
      status,
      orderType: FlightOrderType.RANDOM,
      scheduledAt: startedAt,
      startedAt,
      closedAt,
    },
  });
}

async function ensureFlights(roundId: string, pilots: { id: string; pilotNumber: number }[]) {
  const existing = await prisma.flight.findMany({ where: { roundId } });
  const byPilot = new Map(existing.map((f) => [f.pilotId, f]));
  const flights: { id: string; pilotId: string }[] = [];

  let order = existing.length;
  for (const pilot of pilots) {
    const found = byPilot.get(pilot.id);
    if (found) {
      flights.push({ id: found.id, pilotId: found.pilotId });
      continue;
    }
    order += 1;
    const created = await prisma.flight.create({
      data: {
        roundId,
        pilotId: pilot.id,
        flightOrder: order,
        status: FlightStatus.PENDING,
      },
    });
    flights.push({ id: created.id, pilotId: created.pilotId });
  }
  return flights;
}

async function upsertRoundScores(
  roundId: string,
  roundIndex: number,
  flights: { id: string; pilotId: string }[],
  pilots: { id: string; pilotNumber: number }[],
  judgeId: string,
  enteredAt: Date,
) {
  const pilotById = new Map(pilots.map((p) => [p.id, p]));
  let count = 0;
  let skipped = 0;

  for (const flight of flights) {
    const pilot = pilotById.get(flight.pilotId);
    if (!pilot) continue;
    const row = SCORES[pilot.pilotNumber];
    if (!row || row[roundIndex] == null) {
      skipped += 1;
      continue;
    }
    const parsed = parseCell(row[roundIndex]);

    await prisma.flight.update({
      where: { id: flight.id },
      data: {
        status: parsed.flightStatus,
        launchedAt: enteredAt,
        landedAt: parsed.flightStatus === FlightStatus.SCORED ? enteredAt : null,
      },
    });

    await prisma.score.upsert({
      where: { flightId: flight.id },
      update: {
        distanceCm: parsed.distanceCm,
        resultType: parsed.resultType,
        finalScoreCm: parsed.finalScoreCm,
        isBullseye: parsed.isBullseye,
        status: ScoreStatus.CONFIRMED,
        enteredById: judgeId,
        enteredAt,
      },
      create: {
        flightId: flight.id,
        roundId,
        pilotId: flight.pilotId,
        distanceCm: parsed.distanceCm,
        resultType: parsed.resultType,
        finalScoreCm: parsed.finalScoreCm,
        isBullseye: parsed.isBullseye,
        status: ScoreStatus.CONFIRMED,
        enteredById: judgeId,
        enteredAt,
      },
    });
    count += 1;
  }
  return { count, skipped };
}

async function main() {
  const competition = await prisma.competition.findFirst({
    where: { code: 'NPPL-01' },
  });
  if (!competition) throw new Error('Competition NPPL-01 not found');

  const judge = await prisma.user.findFirst({
    where: { email: { in: ['judge@npha.org.np', 'director@npha.org.np', 'admin@npha.org.np'] } },
  });
  if (!judge) throw new Error('No judge/director user found for enteredById');

  const pilots = await prisma.pilot.findMany({
    where: { competitionId: competition.id },
    orderBy: { pilotNumber: 'asc' },
    select: { id: true, pilotNumber: true },
  });

  const missing = pilots.filter((p) => !SCORES[p.pilotNumber]);
  if (missing.length) {
    console.warn(
      'Pilots with no sheet data at all:',
      missing.map((p) => p.pilotNumber).join(', '),
    );
  }

  const partial = Object.entries(SCORES)
    .filter(([, row]) => row.length < ROUND_COUNT)
    .map(([n, row]) => `#${n} (R1–R${row.length} only)`);
  if (partial.length) {
    console.warn('Partial later rounds (no data yet):', partial.join(', '));
  }

  const schedule: { startedAt: Date; closedAt: Date }[] = [
    {
      startedAt: new Date('2024-11-16T09:00:00+05:45'),
      closedAt: new Date('2024-11-16T12:00:00+05:45'),
    },
    {
      startedAt: new Date('2024-11-16T13:00:00+05:45'),
      closedAt: new Date('2024-11-16T17:00:00+05:45'),
    },
    {
      startedAt: new Date('2024-11-17T09:00:00+05:45'),
      closedAt: new Date('2024-11-17T12:00:00+05:45'),
    },
    {
      startedAt: new Date('2024-11-17T13:00:00+05:45'),
      closedAt: new Date('2024-11-17T17:00:00+05:45'),
    },
    {
      startedAt: new Date('2024-11-18T09:00:00+05:45'),
      closedAt: new Date('2024-11-18T12:00:00+05:45'),
    },
    {
      startedAt: new Date('2024-11-18T13:00:00+05:45'),
      closedAt: new Date('2024-11-18T17:00:00+05:45'),
    },
    {
      startedAt: new Date('2024-11-19T09:00:00+05:45'),
      closedAt: new Date('2024-11-19T12:00:00+05:45'),
    },
    {
      startedAt: new Date('2024-11-19T13:00:00+05:45'),
      closedAt: new Date('2024-11-19T17:00:00+05:45'),
    },
    {
      startedAt: new Date('2024-11-20T09:00:00+05:45'),
      closedAt: new Date('2024-11-20T12:00:00+05:45'),
    },
  ];

  for (let i = 0; i < ROUND_COUNT; i++) {
    const number = i + 1;
    const { startedAt, closedAt } = schedule[i];
    const round = await ensureRound(
      competition.id,
      number,
      RoundStatus.CLOSED,
      startedAt,
      closedAt,
    );
    const flights = await ensureFlights(round.id, pilots);
    const { count, skipped } = await upsertRoundScores(
      round.id,
      i,
      flights,
      pilots,
      judge.id,
      startedAt,
    );
    console.log(
      `✓ Round ${number} CLOSED — ${count} scores` +
        (skipped ? ` (${skipped} pilots without R${number} data)` : ''),
    );
  }

  console.log('Done. Recalculate rankings from Admin or API next.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
