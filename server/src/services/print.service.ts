import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import {
  generateResultsPdf,
  resolveReportCellValue,
  type GenerateReportInput,
  type ResultRow,
} from '@npha/pdf-engine';
import { applyDiscardRules, resolveCompetitionRules } from '@npha/scoring-engine';
import type { PrintFormat, ReportType } from '@npha/shared';
import { formatPilotName, formatScoreCm } from '@npha/utils';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { getCompetition, settingsToRuleOverrides } from './competition.service.js';
import { getIndividualRankings, getTeamRankings, recalculateRankings } from './scoring.service.js';

const RANKING_ROUND_STATUSES = [
  'ACTIVE',
  'PAUSED',
  'CLOSED',
  'PENDING_APPROVAL',
  'APPROVED',
  'LOCKED',
] as const;

/**
 * Delete a print PDF only if it lives under PRINT_ARCHIVE_DIR (avoids path tricks).
 * Disk copies are ephemeral: stream to the client then purge so the archive does not grow.
 */
async function purgePrintArchiveFile(fileUrl: string | null | undefined): Promise<void> {
  if (!fileUrl) return;
  const archiveRoot = path.resolve(env.printArchiveDir);
  const resolved = path.resolve(fileUrl);
  if (resolved !== archiveRoot && !resolved.startsWith(archiveRoot + path.sep)) {
    return;
  }
  try {
    await unlink(resolved);
  } catch {
    // Missing file is fine — already cleaned or never written.
  }
}

/** Clear DB pointer and remove on-disk PDF after the download buffer is prepared. */
async function clearPrintFileAfterDownload(
  printId: string,
  fileUrl: string | null | undefined,
): Promise<void> {
  await purgePrintArchiveFile(fileUrl);
  if (fileUrl) {
    await prisma.printHistory.update({
      where: { id: printId },
      data: { fileUrl: null },
    });
  }
}

function buildApprovalLine(input: {
  firstName: string;
  lastName: string;
  roleLabel: string;
  approvedAt: Date;
}): string {
  const when = input.approvedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  return `Approved by ${input.firstName} ${input.lastName} · ${input.roleLabel} · ${when}`;
}

/**
 * Score PDFs reuse the round approver (who clicked Approve on Rounds / dual-approval complete),
 * so prints for APPROVED/LOCKED rounds carry consistent official attribution.
 */
async function resolveRoundApprovalLine(
  competitionId: string,
  roundId?: string,
): Promise<
  | {
      line: string;
      approvedById: string;
      approvedByRole: string;
      approvedAt: Date;
    }
  | undefined
> {
  const select = {
    status: true,
    approvedAt: true,
    approvedById: true,
    approvedByRole: true,
    approvedBy: { select: { firstName: true, lastName: true } },
  } as const;

  const round = roundId
    ? await prisma.round.findFirst({
        where: { id: roundId, competitionId },
        select,
      })
    : await prisma.round.findFirst({
        where: {
          competitionId,
          status: { in: ['APPROVED', 'LOCKED'] },
          type: 'OFFICIAL',
          approvedAt: { not: null },
        },
        orderBy: [{ approvedAt: 'desc' }, { number: 'desc' }],
        select,
      });

  if (!round || !['APPROVED', 'LOCKED'].includes(round.status)) return undefined;
  if (!round.approvedAt || !round.approvedBy || !round.approvedById) return undefined;

  const roleLabel = round.approvedByRole?.trim() || 'Approver';
  return {
    line: buildApprovalLine({
      firstName: round.approvedBy.firstName,
      lastName: round.approvedBy.lastName,
      roleLabel,
      approvedAt: round.approvedAt,
    }),
    approvedById: round.approvedById,
    approvedByRole: roleLabel,
    approvedAt: round.approvedAt,
  };
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
        const cell = resolveReportCellValue(col, row, scoreIdx);
        if (cell.skip) return '';
        const classes = [
          cell.excluded ? 'excluded' : '',
          cell.bold ? 'bold' : '',
          row.rowKind === 'team_total' ? 'team-total' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const rowspanAttr = cell.rowspan && cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : '';
        const classAttr = classes ? ` class="${classes}"` : '';
        return `<td${rowspanAttr}${classAttr}>${escapeHtml(cell.text)}</td>`;
      });
      const trClass = row.rowKind === 'team_total' ? ' class="team-total-row"' : '';
      return `<tr${trClass}>${cells.join('')}</tr>`;
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
    .npha-report-preview td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; color: #111; vertical-align: middle; }
    .npha-report-preview th { background: #1a365d; color: #fff; font-weight: 600; }
    .npha-report-preview tr:nth-child(even) td:not(.excluded) { background: #fafafa; }
    .npha-report-preview tr.team-total-row td { background: #e8eef5; font-weight: 600; }
    .npha-report-preview td.excluded {
      background: #d1d5db !important;
      color: #4b5563;
      text-decoration: line-through;
      text-align: center;
    }
    .npha-report-preview td.bold { font-weight: 600; }
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
  const roundApproval = await resolveRoundApprovalLine(competitionId, input.roundId);
  if (roundApproval) {
    reportInput.approvalLine = roundApproval.line;
  }
  const html = reportToHtml(reportInput);

  const printRecord = await prisma.printHistory.create({
    data: {
      competitionId,
      roundId: input.roundId,
      reportType: input.reportType,
      format,
      status: roundApproval ? 'APPROVED' : 'PREVIEW',
      printedById: input.printedById,
      approvedAt: roundApproval?.approvedAt,
      approvedById: roundApproval?.approvedById,
      approvedByRole: roundApproval?.approvedByRole,
      metadataJson: {
        html,
        title: reportInput.title,
        ...(roundApproval ? { approvalLine: roundApproval.line } : {}),
      },
    },
  });

  return {
    id: printRecord.id,
    html,
    status: (roundApproval ? 'APPROVED' : 'DRAFT') as 'DRAFT' | 'APPROVED',
    reportType: input.reportType,
    format,
    approvalLine: roundApproval?.line,
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
    const roundApproval = await resolveRoundApprovalLine(competitionId, input.roundId);
    if (roundApproval) {
      reportInput.approvalLine = roundApproval.line;
    }
    const pdf = await generateResultsPdf(reportInput);
    // Keep PDF only in memory for the HTTP response path — do not retain on disk.
    const filename = `${competition.code}-${input.reportType}-${printRecord.id}.pdf`;

    const updated = await prisma.printHistory.update({
      where: { id: printRecord.id },
      data: {
        status: roundApproval ? 'APPROVED' : 'ARCHIVED',
        fileUrl: null,
        pageCount: pdf.pageCount,
        printedAt: new Date(),
        approvedAt: roundApproval?.approvedAt,
        approvedById: roundApproval?.approvedById,
        approvedByRole: roundApproval?.approvedByRole,
        metadataJson: {
          mimeType: pdf.mimeType,
          filename,
          ...(roundApproval ? { approvalLine: roundApproval.line } : {}),
        },
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

  let approvalLine =
    record.status === 'APPROVED' && record.approvedBy && record.approvedByRole && record.approvedAt
      ? buildApprovalLine({
          firstName: record.approvedBy.firstName,
          lastName: record.approvedBy.lastName,
          roleLabel: record.approvedByRole,
          approvedAt: record.approvedAt,
        })
      : undefined;

  // Prefer the round approver when print history was not separately approved.
  let roundApprovalMeta: Awaited<ReturnType<typeof resolveRoundApprovalLine>> | undefined;
  if (!approvalLine) {
    roundApprovalMeta = await resolveRoundApprovalLine(
      competitionId,
      record.roundId ?? undefined,
    );
    if (roundApprovalMeta) approvalLine = roundApprovalMeta.line;
  }

  // Prefer a cached disk file only when no approval stamp is needed (legacy archives).
  // Always purge after load so printed PDFs do not accumulate on the server.
  if (!approvalLine && record.fileUrl) {
    try {
      const buffer = await readFile(record.fileUrl);
      const filename = path.basename(record.fileUrl);
      await clearPrintFileAfterDownload(record.id, record.fileUrl);
      return { buffer, filename };
    } catch {
      // Fall through and regenerate
      await purgePrintArchiveFile(record.fileUrl);
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
  const filename = `${competition.code}-${record.reportType}-${record.id}.pdf`;

  await prisma.printHistory.update({
    where: { id: record.id },
    data: {
      // Ephemeral: no long-lived fileUrl after download path
      fileUrl: null,
      pageCount: pdf.pageCount,
      printedAt: new Date(),
      status:
        record.status === 'APPROVED' || roundApprovalMeta
          ? 'APPROVED'
          : record.status,
      ...(roundApprovalMeta && !record.approvedById
        ? {
            approvedAt: roundApprovalMeta.approvedAt,
            approvedById: roundApprovalMeta.approvedById,
            approvedByRole: roundApprovalMeta.approvedByRole,
          }
        : {}),
    },
  });

  // Remove any previously archived PDF for this print job
  await purgePrintArchiveFile(record.fileUrl);

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
      select: { pilotId: true, roundId: true, finalScoreCm: true, resultType: true, isBullseye: true },
    });
    const scoreMap = new Map(
      scores.map((s) => [`${s.pilotId}:${s.roundId}`, s]),
    );

    const rules = resolveCompetitionRules(
      competition.ruleSet,
      settingsToRuleOverrides(competition.settings),
    );
    const maxCm = rules.maximumScoreCm;
    const discardActive =
      rules.discardWorstRounds > 0 && rounds.length >= rules.discardAfterRounds;
    const roundHeaders = rounds.map((r) => `R${r.number}`);
    const scoredRankings = rankings.filter((r) => r.roundsFlown > 0);

    return {
      reportType,
      format,
      branding,
      title: category === 'WOMEN' ? "Women's Individual Results" : 'Overall Individual Results',
      subtitle: discardActive
        ? 'Excluded (worst) round score is highlighted'
        : undefined,
      columns: ['Rank', 'No', 'Name', 'Country', ...roundHeaders, 'Bullseyes', 'Total'],
      rows: scoredRankings.map((r) => {
        const roundEntries = rounds.map((round) => {
          const existing = scoreMap.get(`${r.pilotId}:${round.id}`);
          return {
            pilotId: r.pilotId,
            roundId: round.id,
            roundNumber: round.number,
            finalScoreCm: existing?.finalScoreCm ?? maxCm,
            resultType: (existing?.resultType ?? 'DNF') as
              | 'MEASURED'
              | 'BULLSEYE'
              | 'MAXIMUM'
              | 'DNF'
              | 'ABS'
              | 'DNS'
              | 'DSQ'
              | 'REFLIGHT'
              | 'PENALTY',
            isBullseye: existing?.isBullseye ?? false,
            isDiscarded: false,
            isProvisional: !existing,
          };
        });

        const { discarded } = applyDiscardRules(roundEntries, rules);
        const discardedRoundIds = new Set(discarded.map((d) => d.roundId));

        return {
          rank: r.rank,
          pilotNumber: r.pilot.pilotNumber,
          name: formatPilotName(r.pilot.firstName, r.pilot.lastName),
          country: r.pilot.country?.name ?? r.pilot.nationality ?? '',
          scores: [
            ...rounds.map((round) => {
              const existing = scoreMap.get(`${r.pilotId}:${round.id}`);
              // Missing round on overall sheet uses competition maximum (e.g. 500).
              const value = formatScoreCm(existing?.finalScoreCm ?? maxCm);
              return discardedRoundIds.has(round.id) ? { value, excluded: true } : value;
            }),
            r.bullseyes,
          ],
          total: formatScoreCm(r.totalScoreCm),
          notes: `${r.roundsFlown}r / ${r.bullseyes}•`,
        };
      }),
      footerNote: discardActive
        ? 'FAI Sporting Code Section 7C · Worst round score excluded from total'
        : undefined,
    };
  }

  if (reportType === 'TEAM_RESULTS') {
    await recalculateRankings(competition.id);
    const rankings = await getTeamRankings(competition.id);

    const rounds = await prisma.round.findMany({
      where: {
        competitionId: competition.id,
        type: 'OFFICIAL',
        status: { in: [...RANKING_ROUND_STATUSES] },
      },
      orderBy: { number: 'asc' },
      select: { id: true, number: true },
    });

    const teams = await prisma.team.findMany({
      where: { competitionId: competition.id },
      include: {
        members: {
          include: {
            pilot: { select: { id: true, firstName: true, lastName: true, pilotNumber: true } },
          },
          orderBy: [{ order: 'asc' }],
        },
      },
    });
    const teamById = new Map(teams.map((t) => [t.id, t]));

    const teamScores = await prisma.teamScore.findMany({
      where: {
        teamId: { in: teams.map((t) => t.id) },
        roundId: { in: rounds.map((r) => r.id) },
      },
    });

    type PilotContrib = {
      pilotId: string;
      scoreCm: number;
      counted: boolean;
      reason?: string;
    };

    const contribByTeamRound = new Map<string, Map<string, PilotContrib>>();
    const roundTotalByTeamRound = new Map<string, number>();

    for (const ts of teamScores) {
      const key = `${ts.teamId}:${ts.roundId}`;
      roundTotalByTeamRound.set(key, ts.totalScoreCm);
      const map = new Map<string, PilotContrib>();
      const counted = (ts.countedPilots as PilotContrib[] | null) ?? [];
      const discarded = (ts.discardedPilots as PilotContrib[] | null) ?? [];
      for (const c of counted) map.set(c.pilotId, { ...c, counted: true });
      for (const c of discarded) map.set(c.pilotId, { ...c, counted: false });
      contribByTeamRound.set(key, map);
    }

    const scoreRows = await prisma.score.findMany({
      where: {
        roundId: { in: rounds.map((r) => r.id) },
        status: { in: ['ENTERED', 'CONFIRMED', 'APPROVED', 'LOCKED'] },
      },
      select: { pilotId: true, roundId: true, finalScoreCm: true, resultType: true },
    });
    const rawScoreByPilotRound = new Map(
      scoreRows.map((s) => [`${s.pilotId}:${s.roundId}`, s] as const),
    );

    const formatTeamCell = (
      pilotId: string,
      roundId: string,
      contrib: PilotContrib | undefined,
    ): { value: string; excluded?: boolean } => {
      const raw = rawScoreByPilotRound.get(`${pilotId}:${roundId}`);
      const cm = contrib?.scoreCm ?? raw?.finalScoreCm ?? null;
      const resultType = raw?.resultType;
      let value: string;
      if (resultType && !['MEASURED', 'BULLSEYE', 'MAXIMUM'].includes(resultType)) {
        value = resultType;
      } else if (cm == null) {
        value = '—';
      } else {
        value = formatScoreCm(cm);
      }
      return { value, excluded: contrib ? !contrib.counted : false };
    };

    const roundHeaders = rounds.map((r) => `R${r.number}`);
    const rows: ResultRow[] = [];

    for (const ranking of rankings) {
      const team = teamById.get(ranking.teamId);
      if (!team) continue;
      const members = team.members.filter((m) => m.pilot);
      if (members.length === 0) continue;

      const span = members.length + 1; // pilots + Total row
      const teamTotalLabel = formatScoreCm(ranking.totalScoreCm);

      members.forEach((member, idx) => {
        const pilot = member.pilot;
        const roundCells = rounds.map((round) => {
          const contrib = contribByTeamRound
            .get(`${team.id}:${round.id}`)
            ?.get(pilot.id);
          return formatTeamCell(pilot.id, round.id, contrib);
        });

        rows.push({
          rank: ranking.rank,
          team: team.name,
          name: formatPilotName(pilot.firstName, pilot.lastName),
          scores: roundCells,
          total: teamTotalLabel,
          rowKind: 'team_pilot',
          hideRank: idx > 0,
          hideTeam: idx > 0,
          rankRowspan: idx === 0 ? span : undefined,
          teamRowspan: idx === 0 ? span : undefined,
        });
      });

      rows.push({
        rank: ranking.rank,
        team: team.name,
        name: 'Total',
        scores: rounds.map((round) => {
          const total = roundTotalByTeamRound.get(`${team.id}:${round.id}`);
          return total != null ? formatScoreCm(total) : '—';
        }),
        total: teamTotalLabel,
        rowKind: 'team_total',
        hideRank: true,
        hideTeam: true,
      });
    }

    return {
      reportType,
      format,
      branding,
      title: 'Team Results',
      subtitle: 'Excluded (worst) pilot score per round is highlighted',
      columns: ['Rank', 'Team', 'Pilot Name', 'Team Total', ...roundHeaders],
      rows,
      footerNote: 'FAI Sporting Code Section 7C · Worst pilot score per team round excluded',
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
