import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generateResultsPdf, type GenerateReportInput } from '@npha/pdf-engine';
import type { PrintFormat, ReportType } from '@npha/shared';
import { formatPilotName } from '@npha/utils';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { getCompetition } from './competition.service.js';
import { getIndividualRankings, getTeamRankings } from './scoring.service.js';

export async function generateReport(
  competitionId: string,
  input: {
    reportType: ReportType;
    format?: PrintFormat;
    roundId?: string;
    printedById?: string;
  },
) {
  const competition = await getCompetition(competitionId);
  const format = input.format ?? 'A4_PORTRAIT';

  const printRecord = await prisma.printHistory.create({
    data: {
      competitionId,
      roundId: input.roundId,
      reportType: input.reportType,
      format,
      status: 'PENDING',
      printedById: input.printedById,
    },
  });

  try {
    const reportInput = await buildReportInput(competition, input.reportType, format, input.roundId);
    const pdf = await generateResultsPdf(reportInput);

    await mkdir(env.printArchiveDir, { recursive: true });
    const filename = `${competition.code}-${input.reportType}-${printRecord.id}.pdf`;
    const filePath = path.join(env.printArchiveDir, filename);
    await writeFile(filePath, pdf.buffer);

    const updated = await prisma.printHistory.update({
      where: { id: printRecord.id },
      data: {
        status: 'ARCHIVED',
        fileUrl: filePath,
        pageCount: pdf.pageCount,
        printedAt: new Date(),
        metadataJson: { mimeType: pdf.mimeType },
      },
    });

    return { print: updated, buffer: pdf.buffer, filename };
  } catch (err) {
    await prisma.printHistory.update({
      where: { id: printRecord.id },
      data: {
        status: 'FAILED',
        metadataJson: { error: err instanceof Error ? err.message : 'Unknown error' },
      },
    });
    throw AppError.internal('PDF generation failed');
  }
}

async function buildReportInput(
  competition: Awaited<ReturnType<typeof getCompetition>>,
  reportType: ReportType,
  format: PrintFormat,
  roundId?: string,
): Promise<GenerateReportInput> {
  const branding = {
    competitionName: competition.name,
    organizer: competition.organizer,
    venue: competition.venue,
    country: competition.country,
    dateLabel: `${competition.startDate.toISOString().slice(0, 10)} – ${competition.endDate.toISOString().slice(0, 10)}`,
    publicResultsUrl: `${env.PUBLIC_RESULTS_URL}/${competition.publicSlug}`,
  };

  if (reportType === 'OVERALL_RESULTS') {
    const rankings = await getIndividualRankings(competition.id, 'OVERALL');
    const roundNumbers = [...new Set(rankings.flatMap(() => []))];
    return {
      reportType,
      format,
      branding,
      title: 'Overall Individual Results',
      columns: ['Rank', 'No', 'Name', 'Country', 'Total'],
      rows: rankings.map((r) => ({
        rank: r.rank,
        pilotNumber: r.pilot.pilotNumber,
        name: formatPilotName(r.pilot.firstName, r.pilot.lastName),
        country: r.pilot.country?.name ?? r.pilot.nationality ?? '',
        scores: roundNumbers.map(() => ''),
        total: r.totalScoreCm,
      })),
    };
  }

  if (reportType === 'TEAM_RESULTS') {
    const rankings = await getTeamRankings(competition.id);
    return {
      reportType,
      format,
      branding,
      title: 'Team Results',
      columns: ['Rank', 'Team', 'Country', 'Total'],
      rows: rankings.map((r) => ({
        rank: r.rank,
        name: r.team.name,
        country: r.team.country?.name ?? '',
        scores: [],
        total: r.totalScoreCm,
      })),
    };
  }

  if (reportType === 'ROUND_RESULTS' && roundId) {
    const scores = await prisma.score.findMany({
      where: { roundId },
      include: { pilot: { include: { country: true } }, round: true },
      orderBy: { finalScoreCm: 'asc' },
    });
    const round = scores[0]?.round;
    return {
      reportType,
      format,
      branding: { ...branding, roundNumber: round?.number },
      title: `Round ${round?.number ?? ''} Results`,
      columns: ['Rank', 'No', 'Name', 'Country', 'Score (cm)'],
      rows: scores.map((s, i) => ({
        rank: i + 1,
        pilotNumber: s.pilot.pilotNumber,
        name: formatPilotName(s.pilot.firstName, s.pilot.lastName),
        country: s.pilot.country?.name ?? '',
        scores: [s.finalScoreCm ?? '—'],
        total: s.finalScoreCm ?? '—',
      })),
    };
  }

  throw AppError.badRequest(`Unsupported report type: ${reportType}`);
}

export async function listPrintHistory(competitionId: string) {
  await getCompetition(competitionId);
  return prisma.printHistory.findMany({
    where: { competitionId },
    orderBy: { createdAt: 'desc' },
    include: { printedBy: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function approvePrint(competitionId: string, printId: string) {
  const record = await prisma.printHistory.findFirst({
    where: { id: printId, competitionId },
  });
  if (!record) throw AppError.notFound('Print record not found');

  return prisma.printHistory.update({
    where: { id: printId },
    data: { status: 'APPROVED', approvedAt: new Date() },
  });
}
