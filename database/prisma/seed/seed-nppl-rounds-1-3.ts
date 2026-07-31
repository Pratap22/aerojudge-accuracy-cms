/**
 * Seed NPPL rounds 1–3 scores from Dharan Accuracy Final Individual results.
 * Run: npx tsx prisma/seed/seed-nppl-rounds-1-3.ts  (from database/)
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

/** Raw cell from results sheet: number string, DNF, DQF, etc. */
type Cell = string;

/** pilotNumber → [R1, R2, R3] */
const SCORES_R1_R3: Record<number, [Cell, Cell, Cell]> = {
  30: ['005', '003', '002'],
  32: ['032', '020', '002'],
  10: ['001', '002', '000'],
  13: ['009', '001', '022'],
  9: ['017', '500', '039'],
  18: ['001', '022', '044'],
  11: ['092', '004', '500'],
  5: ['041', '007', '130'],
  25: ['004', '000', '006'],
  21: ['001', '003', '500'],
  22: ['019', '391', '148'],
  16: ['002', '000', '002'],
  1: ['500', '042', '049'],
  4: ['001', '002', '159'],
  31: ['003', '500', '007'],
  7: ['246', '500', '003'],
  3: ['500', '007', '226'],
  12: ['004', '009', '500'],
  27: ['028', '500', '014'],
  15: ['500', '096', '009'],
  28: ['033', '005', '002'],
  29: ['007', '020', '189'],
  19: ['040', '500', '201'],
  26: ['053', '049', '500'],
  24: ['500', '500', '158'],
  8: ['500', '006', '500'],
  23: ['500', '500', '150'],
  14: ['500', '500', '500'],
  17: ['249', '500', '500'],
  6: ['500', '088', '500'],
  2: ['500', '500', '500'],
  20: ['DNF', 'DNF', 'DNF'],
  33: ['DNF', 'DNF', 'DNF'],
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
  roundIndex: 0 | 1 | 2,
  flights: { id: string; pilotId: string }[],
  pilots: { id: string; pilotNumber: number }[],
  judgeId: string,
  enteredAt: Date,
) {
  const pilotById = new Map(pilots.map((p) => [p.id, p]));
  let count = 0;

  for (const flight of flights) {
    const pilot = pilotById.get(flight.pilotId);
    if (!pilot) continue;
    const row = SCORES_R1_R3[pilot.pilotNumber];
    if (!row) {
      console.warn(`No R1–R3 data for pilot #${pilot.pilotNumber} — skip`);
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
  return count;
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

  const missing = pilots.filter((p) => !SCORES_R1_R3[p.pilotNumber]);
  if (missing.length) {
    console.warn(
      'Pilots without sheet data:',
      missing.map((p) => p.pilotNumber).join(', '),
    );
  }

  const t1 = new Date('2024-11-16T09:00:00+05:45');
  const t2 = new Date('2024-11-16T13:00:00+05:45');
  const t3 = new Date('2024-11-17T09:00:00+05:45');
  const c1 = new Date('2024-11-16T12:00:00+05:45');
  const c2 = new Date('2024-11-16T17:00:00+05:45');
  const c3 = new Date('2024-11-17T12:00:00+05:45');

  // R1 + R2 closed (complete), R3 closed after seeding so rankings include all three
  const r1 = await ensureRound(competition.id, 1, RoundStatus.CLOSED, t1, c1);
  const r2 = await ensureRound(competition.id, 2, RoundStatus.CLOSED, t2, c2);
  const r3 = await ensureRound(competition.id, 3, RoundStatus.CLOSED, t3, c3);

  const f1 = await ensureFlights(r1.id, pilots);
  const f2 = await ensureFlights(r2.id, pilots);
  const f3 = await ensureFlights(r3.id, pilots);

  const n1 = await upsertRoundScores(r1.id, 0, f1, pilots, judge.id, t1);
  const n2 = await upsertRoundScores(r2.id, 1, f2, pilots, judge.id, t2);
  const n3 = await upsertRoundScores(r3.id, 2, f3, pilots, judge.id, t3);

  console.log(`✓ Round 1 CLOSED — ${n1} scores`);
  console.log(`✓ Round 2 CLOSED — ${n2} scores`);
  console.log(`✓ Round 3 CLOSED — ${n3} scores`);
  console.log('Run ranking recalculation from Admin or API if needed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
