import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  generateResultsPdf,
  resolveReportCellValue,
  type GenerateReportInput,
} from '@npha/pdf-engine';
import type { PrintFormat, ReportType } from '@npha/shared';
import { formatPilotName, formatScoreCm } from '@npha/utils';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { getCompetition } from './competition.service.js';
import { getIndividualRankings, getTeamRankings, recalculateRankings } from './scoring.service.js';

const RANKING_ROUND_STATUSES = [
  'ACTIVE',
  'PAUSED',
  'CLOSED',
  'PENDING_APPROVAL',
  'APPROVED',
  'LOCKED',
] as const;

function buildApprovalLine(input: {
  firstName: string;
  lastName: string;
  roleLabel: string;
  approvedAt: Date;
}): string {
  const when = input.approvedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  return `Approved by ${input.firstName} ${input.lastName} · ${input.roleLabel} · ${when}`;
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function reportToHtml(input: GenerateReportInput): string {
  const headerCells = input.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const bodyRows = input.rows
    .map((row) => {
      const scoreIdx = { current: 0 };
      const cells = input.columns.map((col) => {
        const key = col.toLowerCase().trim();
        if (key === 'signature' || key === 'sign' || key.includes('signature')) {
          return `<td class="sig">&nbsp;</td>`;
        }
        return `<td>${escapeHtml(resolveReportCellValue(col, row, scoreIdx))}</td>`;
      });
      return `<tr>${cells.join('')}</tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    html, body { margin: 0; padding: 0; background: #fff; }
    .npha-report-preview {
      font-family: Georgia, 'Times New Roman', serif;
      color: #111;
      padding: 24px;
      box-sizing: border-box;
    }
    .npha-report-preview h1 { font-size: 22px; margin: 0 0 4px; color: #111; }
    .npha-report-preview h2 { font-size: 14px; font-weight: normal; color: #444; margin: 0 0 16px; }
    .npha-report-preview .meta { font-size: 12px; color: #555; margin-bottom: 20px; }
    .npha-report-preview table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .npha-report-preview th,
    .npha-report-preview td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; color: #111; }
    .npha-report-preview th { background: #f3f6fa; font-weight: 600; }
    .npha-report-preview tr:nth-child(even) td { background: #fafafa; }
    .npha-report-preview td.sig { min-width: 140px; height: 32px; background: #fff; }
    .npha-report-preview .footer { margin-top: 24px; font-size: 11px; color: #666; }
    .npha-report-preview .approval {
      margin-top: 16px;
      font-size: 12px;
      font-weight: 600;
      color: #111;
    }
    @media print {
      .npha-report-preview { padding: 12px 16px 48px; }
      .print-page-footer {
        position: fixed;
        bottom: 12px;
        left: 16px;
        right: 16px;
        text-align: center;
        font-size: 10px;
        color: #111;
        border-top: 1px solid #ccc;
        padding-top: 6px;
        background: #fff;
      }
      .npha-report-preview .approval { display: none; }
    }
    @media screen {
      .print-page-footer { display: none; }
    }
  </style>
</head>
<body>
  <div class="npha-report-preview">
    <h1>${escapeHtml(input.title)}</h1>
    <h2>${escapeHtml(input.branding.competitionName)}</h2>
    <div class="meta">
      ${escapeHtml(input.branding.organizer)} · ${escapeHtml(input.branding.venue)},
      ${escapeHtml(input.branding.country)} · ${escapeHtml(input.branding.dateLabel)}
      ${input.subtitle ? `<br/>${escapeHtml(input.subtitle)}` : ''}
    </div>
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows || `<tr><td colspan="${input.columns.length}">No data available</td></tr>`}</tbody>
    </table>
    <div class="footer">
      ${input.approvalLine ? `<div class="approval">${escapeHtml(input.approvalLine)}</div>` : ''}
      ${escapeHtml(input.footerNote ?? 'FAI Sporting Code Section 7C · Preview')}
      · ${escapeHtml(input.branding.publicResultsUrl)}
    </div>
  </div>
  ${
    input.approvalLine
      ? `<div class="print-page-footer">${escapeHtml(input.approvalLine)}</div>`
      : ''
  }
</body>
</html>`;
}

export async function previewReport(
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
  const reportInput = await buildReportInput(competition, input.reportType, format, input.roundId);
  const html = reportToHtml(reportInput);

  const printRecord = await prisma.printHistory.create({
    data: {
      competitionId,
      roundId: input.roundId,
      reportType: input.reportType,
      format,
      status: 'PREVIEW',
      printedById: input.printedById,
      metadataJson: { html, title: reportInput.title },
    },
  });

  return {
    id: printRecord.id,
    html,
    status: 'DRAFT' as const,
    reportType: input.reportType,
    format,
  };
}

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
    throw AppError.internal(
      `PDF generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
  }
}

export async function downloadReport(competitionId: string, printId: string) {
  const record = await prisma.printHistory.findFirst({
    where: { id: printId, competitionId },
    include: {
      approvedBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!record) throw AppError.notFound('Print record not found');

  const approvalLine =
    record.status === 'APPROVED' && record.approvedBy && record.approvedByRole && record.approvedAt
      ? buildApprovalLine({
          firstName: record.approvedBy.firstName,
          lastName: record.approvedBy.lastName,
          roleLabel: record.approvedByRole,
          approvedAt: record.approvedAt,
        })
      : undefined;

  // Approved downloads always regenerate so the PDF includes the approval line
  if (!approvalLine && record.fileUrl) {
    try {
      const buffer = await readFile(record.fileUrl);
      const filename = path.basename(record.fileUrl);
      return { buffer, filename };
    } catch {
      // Fall through and regenerate
    }
  }

  const competition = await getCompetition(competitionId);
  const format = (record.format as PrintFormat) ?? 'A4_PORTRAIT';
  const reportInput = await buildReportInput(
    competition,
    record.reportType as ReportType,
    format,
    record.roundId ?? undefined,
  );
  if (approvalLine) {
    reportInput.approvalLine = approvalLine;
  }

  const pdf = await generateResultsPdf(reportInput);
  await mkdir(env.printArchiveDir, { recursive: true });
  const filename = `${competition.code}-${record.reportType}-${record.id}.pdf`;
  const filePath = path.join(env.printArchiveDir, filename);
  await writeFile(filePath, pdf.buffer);

  await prisma.printHistory.update({
    where: { id: record.id },
    data: {
      fileUrl: filePath,
      pageCount: pdf.pageCount,
      printedAt: new Date(),
      status: record.status === 'APPROVED' ? 'APPROVED' : record.status,
    },
  });

  return { buffer: pdf.buffer, filename };
}

export async function listPrintHistory(competitionId: string) {
  await getCompetition(competitionId);
  return prisma.printHistory.findMany({
    where: { competitionId },
    orderBy: { createdAt: 'desc' },
    include: {
      printedBy: { select: { id: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function approvePrint(
  competitionId: string,
  printId: string,
  approver: { userId: string; roleLabel: string },
) {
  const record = await prisma.printHistory.findFirst({
    where: { id: printId, competitionId },
  });
  if (!record) throw AppError.notFound('Print record not found');

  const user = await prisma.user.findUnique({
    where: { id: approver.userId },
    select: { firstName: true, lastName: true },
  });
  if (!user) throw AppError.notFound('Approver not found');

  const approvedAt = new Date();
  const approvalLine = buildApprovalLine({
    firstName: user.firstName,
    lastName: user.lastName,
    roleLabel: approver.roleLabel,
    approvedAt,
  });

  const competition = await getCompetition(competitionId);
  const reportInput = await buildReportInput(
    competition,
    record.reportType as ReportType,
    (record.format as PrintFormat) ?? 'A4_PORTRAIT',
    record.roundId ?? undefined,
  );
  reportInput.approvalLine = approvalLine;
  const html = reportToHtml(reportInput);

  const previousMeta =
    record.metadataJson && typeof record.metadataJson === 'object' && !Array.isArray(record.metadataJson)
      ? (record.metadataJson as Record<string, unknown>)
      : {};

  const updated = await prisma.printHistory.update({
    where: { id: printId },
    data: {
      status: 'APPROVED',
      approvedAt,
      approvedById: approver.userId,
      approvedByRole: approver.roleLabel,
      fileUrl: null,
      metadataJson: {
        ...previousMeta,
        html,
        title: reportInput.title,
        approvalLine,
      },
    },
    include: {
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return { ...updated, html, approvalLine };
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

  if (reportType === 'OVERALL_RESULTS' || reportType === 'WOMEN_RESULTS') {
    const category = reportType === 'WOMEN_RESULTS' ? 'WOMEN' : 'OVERALL';
    // Refresh standings so live ACTIVE-round scores appear in the report.
    await recalculateRankings(competition.id);
    const rankings = await getIndividualRankings(competition.id, category);

    const rounds = await prisma.round.findMany({
      where: {
        competitionId: competition.id,
        type: 'OFFICIAL',
        status: { in: [...RANKING_ROUND_STATUSES] },
      },
      orderBy: { number: 'asc' },
      select: { id: true, number: true },
    });

    const scores = await prisma.score.findMany({
      where: {
        roundId: { in: rounds.map((r) => r.id) },
        status: { in: ['ENTERED', 'CONFIRMED', 'APPROVED', 'LOCKED'] },
        finalScoreCm: { not: null },
      },
      select: { pilotId: true, roundId: true, finalScoreCm: true },
    });
    const scoreMap = new Map(
      scores.map((s) => [`${s.pilotId}:${s.roundId}`, s.finalScoreCm as number]),
    );

    const maxCm =
      (competition.settings as { maximumScoreCm?: number } | null)?.maximumScoreCm ?? 500;
    const roundHeaders = rounds.map((r) => `R${r.number}`);
    const scoredRankings = rankings.filter((r) => r.roundsFlown > 0);
    return {
      reportType,
      format,
      branding,
      title: category === 'WOMEN' ? "Women's Individual Results" : 'Overall Individual Results',
      columns: ['Rank', 'No', 'Name', 'Country', ...roundHeaders, 'Bullseyes', 'Total'],
      rows: scoredRankings.map((r) => ({
        rank: r.rank,
        pilotNumber: r.pilot.pilotNumber,
        name: formatPilotName(r.pilot.firstName, r.pilot.lastName),
        country: r.pilot.country?.name ?? r.pilot.nationality ?? '',
        scores: [
          ...rounds.map((round) => {
            const cm = scoreMap.get(`${r.pilotId}:${round.id}`);
            // Missing round on overall sheet uses competition maximum (e.g. 500).
            return formatScoreCm(cm ?? maxCm);
          }),
          r.bullseyes,
        ],
        total: formatScoreCm(r.totalScoreCm),
        notes: `${r.roundsFlown}r / ${r.bullseyes}•`,
      })),
    };
  }

  if (reportType === 'TEAM_RESULTS') {
    await recalculateRankings(competition.id);
    const rankings = await getTeamRankings(competition.id);
    return {
      reportType,
      format,
      branding,
      title: 'Team Results',
      columns: ['Rank', 'Team', 'Country', 'Rounds', 'Total'],
      rows: rankings.map((r) => ({
        rank: r.rank,
        name: r.team.name,
        country: r.team.country?.name ?? '',
        scores: [r.roundsScored],
        total: formatScoreCm(r.totalScoreCm),
      })),
    };
  }

  if (reportType === 'PILOT_LIST' || reportType === 'REGISTRATION_LIST') {
    const pilots = await prisma.pilot.findMany({
      where: { competitionId: competition.id },
      include: { country: true },
      orderBy: { pilotNumber: 'asc' },
    });
    return {
      reportType,
      format,
      branding,
      title: reportType === 'REGISTRATION_LIST' ? 'Registration List' : 'Pilot List',
      columns: ['No', 'Name', 'Country', 'Gender', 'Club', 'Status'],
      rows: pilots.map((p, i) => ({
        rank: i + 1,
        pilotNumber: p.pilotNumber,
        name: formatPilotName(p.firstName, p.lastName),
        country: p.country?.name ?? p.nationality ?? '',
        scores: [p.gender, p.club ?? '', p.status],
        total: '',
        notes: p.status,
      })),
    };
  }

  if (reportType === 'LAUNCH_ORDER') {
    const round = roundId
      ? await prisma.round.findFirst({ where: { id: roundId, competitionId: competition.id } })
      : await prisma.round.findFirst({
          where: { competitionId: competition.id },
          orderBy: [{ number: 'desc' }, { createdAt: 'desc' }],
        });

    if (!round) {
      return {
        reportType,
        format,
        branding,
        title: 'Launch Order',
        subtitle: 'No rounds available',
        columns: ['Order', 'No', 'Name', 'Country', 'Signature'],
        rows: [],
      };
    }

    const flights = await prisma.flight.findMany({
      where: { roundId: round.id },
      include: { pilot: { include: { country: true } } },
      orderBy: { flightOrder: 'asc' },
    });

    return {
      reportType,
      format,
      branding: { ...branding, roundNumber: round.number },
      title: `Launch Order — Round ${round.number}`,
      columns: ['Order', 'No', 'Name', 'Country', 'Signature'],
      rows: flights.map((f) => ({
        rank: f.flightOrder,
        pilotNumber: f.pilot.pilotNumber,
        name: formatPilotName(f.pilot.firstName, f.pilot.lastName),
        country: f.pilot.country?.name ?? '',
        scores: [''],
        total: '',
      })),
    };
  }

  if (reportType === 'ROUND_RESULTS') {
    await recalculateRankings(competition.id);
    const round = roundId
      ? await prisma.round.findFirst({ where: { id: roundId, competitionId: competition.id } })
      : await prisma.round.findFirst({
          where: {
            competitionId: competition.id,
            type: 'OFFICIAL',
            status: { in: [...RANKING_ROUND_STATUSES] },
          },
          orderBy: [{ number: 'desc' }],
        });

    if (!round) {
      return {
        reportType,
        format,
        branding,
        title: 'Round Results',
        subtitle: 'No scored rounds available',
        columns: ['Rank', 'No', 'Name', 'Country', 'Score (cm)'],
        rows: [],
      };
    }

    const scores = await prisma.score.findMany({
      where: {
        roundId: round.id,
        status: { in: ['ENTERED', 'CONFIRMED', 'APPROVED', 'LOCKED'] },
        finalScoreCm: { not: null },
      },
      include: { pilot: { include: { country: true } } },
      orderBy: [{ finalScoreCm: 'asc' }, { pilot: { pilotNumber: 'asc' } }],
    });

    return {
      reportType,
      format,
      branding: { ...branding, roundNumber: round.number },
      title: `Round ${round.number} Results`,
      columns: ['Rank', 'No', 'Name', 'Country', 'Score (cm)'],
      rows: scores.map((s, i) => ({
        rank: i + 1,
        pilotNumber: s.pilot.pilotNumber,
        name: formatPilotName(s.pilot.firstName, s.pilot.lastName),
        country: s.pilot.country?.name ?? s.pilot.nationality ?? '',
        scores: [],
        total: formatScoreCm(s.finalScoreCm),
      })),
    };
  }

  if (reportType === 'STATISTICS') {
    const [pilotCount, teamCount, scoreCount, bullseyes] = await Promise.all([
      prisma.pilot.count({ where: { competitionId: competition.id } }),
      prisma.team.count({ where: { competitionId: competition.id } }),
      prisma.score.count({ where: { round: { competitionId: competition.id } } }),
      prisma.score.count({
        where: { round: { competitionId: competition.id }, isBullseye: true },
      }),
    ]);
    return {
      reportType,
      format,
      branding,
      title: 'Competition Statistics',
      columns: ['Metric', 'Value'],
      rows: [
        { rank: 1, name: 'Pilots', scores: [], total: pilotCount },
        { rank: 2, name: 'Teams', scores: [], total: teamCount },
        { rank: 3, name: 'Scores recorded', scores: [], total: scoreCount },
        { rank: 4, name: 'Bullseyes', scores: [], total: bullseyes },
      ],
    };
  }

  // Remaining types: show a structured placeholder so preview never 404s
  return {
    reportType,
    format,
    branding,
    title: reportType.replace(/_/g, ' '),
    subtitle: 'Detailed layout for this report type is not fully configured yet.',
    columns: ['Item', 'Notes'],
    rows: [
      {
        rank: 1,
        name: reportType,
        scores: [],
        total: 'Coming soon',
        notes: 'Use Overall / Team / Pilot List / Round Results for full previews.',
      },
    ],
    footerNote: 'Preview placeholder',
  };
}
