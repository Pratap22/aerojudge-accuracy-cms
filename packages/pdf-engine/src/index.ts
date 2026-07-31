/**
 * PDF Engine – official competition result sheets
 * A4 / Letter, headers, signatures, QR to live results, page numbers.
 */

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type { PrintFormat, ReportType } from '@npha/shared';

export interface ReportBranding {
  competitionName: string;
  organizer: string;
  venue: string;
  country: string;
  dateLabel: string;
  roundNumber?: number;
  logoPath?: string;
  organizerLogoPath?: string;
  sponsorLogos?: string[];
  publicResultsUrl: string;
  chiefJudgeName?: string;
  directorName?: string;
}

export interface ResultRow {
  rank: number;
  pilotNumber?: number;
  name: string;
  country?: string;
  team?: string;
  scores: (number | string)[];
  total: number | string;
  notes?: string;
}

/**
 * Map a column header to a cell value.
 * Important: do not use key.includes('rank') — "Rounds" contains "rank" and would steal the rank value.
 */
export function resolveReportCellValue(
  column: string,
  row: ResultRow,
  scoreIdx: { current: number },
): string {
  const key = column.toLowerCase().trim();

  if (key === 'rank' || key === '#' || key === 'order') return String(row.rank);
  if (key === 'no' || key === 'number' || key === 'pilot no' || key === 'pilot number')
    return row.pilotNumber != null ? String(row.pilotNumber) : '';
  if (
    key === 'name' ||
    key === 'team' ||
    key === 'pilot' ||
    key === 'metric' ||
    key === 'item'
  ) {
    return row.name;
  }
  if (key === 'country' || key.startsWith('country')) return row.country ?? '';
  if (key === 'signature' || key === 'sign' || key.includes('signature')) return '';
  if (key === 'total' || key === 'value' || key === 'score (cm)' || key.endsWith(' total'))
    return String(row.total);
  if (key === 'notes' || key === 'note') return row.notes ?? '';

  const value = row.scores?.[scoreIdx.current];
  scoreIdx.current += 1;
  return value != null ? String(value) : '';
}


export interface GenerateReportInput {
  reportType: ReportType;
  format: PrintFormat;
  branding: ReportBranding;
  title: string;
  subtitle?: string;
  columns: string[];
  rows: ResultRow[];
  footerNote?: string;
  /** Shown at the bottom of every page once the report is approved */
  approvalLine?: string;
}

export interface GeneratedPdf {
  buffer: Buffer;
  pageCount: number;
  mimeType: 'application/pdf';
}

function pageSize(format: PrintFormat): [number, number] {
  switch (format) {
    case 'A4_LANDSCAPE':
      return [841.89, 595.28];
    case 'LETTER_PORTRAIT':
      return [612, 792];
    case 'LETTER_LANDSCAPE':
      return [792, 612];
    case 'A4_PORTRAIT':
    default:
      return [595.28, 841.89];
  }
}

async function qrBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { type: 'png', width: 120, margin: 1 });
}

export async function generateResultsPdf(input: GenerateReportInput): Promise<GeneratedPdf> {
  const size = pageSize(input.format);
  /** Reserved band at page bottom for approval + page numbers (outside content flow). */
  const FOOTER_BAND = 56;
  const doc = new PDFDocument({
    size,
    margins: { top: 50, bottom: FOOTER_BAND + 8, left: 40, right: 40 },
    bufferPages: true,
    info: {
      Title: input.title,
      Author: input.branding.organizer,
      Subject: `${input.branding.competitionName} – ${input.reportType}`,
      Creator: 'AeroJudge',
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  // Header
  doc.fontSize(16).font('Helvetica-Bold').text(input.branding.competitionName, { align: 'center' });
  doc.fontSize(10).font('Helvetica').text(input.branding.organizer, { align: 'center' });
  doc
    .fontSize(9)
    .fillColor('#444')
    .text(`${input.branding.venue}, ${input.branding.country} · ${input.branding.dateLabel}`, {
      align: 'center',
    });
  doc.moveDown(0.5);
  doc.fillColor('#000').fontSize(13).font('Helvetica-Bold').text(input.title, { align: 'center' });
  if (input.subtitle) {
    doc.fontSize(10).font('Helvetica').text(input.subtitle, { align: 'center' });
  }
  if (input.branding.roundNumber != null) {
    doc.fontSize(10).text(`Round ${input.branding.roundNumber}`, { align: 'center' });
  }
  doc.moveDown(0.8);

  // Table header
  const startX = doc.page.margins.left;
  const usableWidth = size[0] - doc.page.margins.left - doc.page.margins.right;
  const colCount = Math.max(input.columns.length, 1);
  const colWidth = usableWidth / colCount;
  const contentBottom = size[1] - FOOTER_BAND - 90;

  const drawTableHeader = () => {
    const y = doc.y;
    doc.rect(startX, y, usableWidth, 18).fill('#1a365d');
    doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold');
    input.columns.forEach((col, i) => {
      doc.text(col, startX + i * colWidth + 3, y + 5, {
        width: colWidth - 6,
        ellipsis: true,
        lineBreak: false,
      });
    });
    doc.fillColor('#000').font('Helvetica');
    doc.y = y + 22;
  };

  drawTableHeader();

  for (const row of input.rows) {
    if (doc.y > contentBottom) {
      doc.addPage();
      drawTableHeader();
    }

    const scoreIdx = { current: 0 };
    const filled = input.columns.map((col) => resolveReportCellValue(col, row, scoreIdx));

    const rowY = doc.y;
    if (row.rank % 2 === 0) {
      doc.rect(startX, rowY - 2, usableWidth, 14).fill('#f7fafc');
      doc.fillColor('#000');
    }

    filled.forEach((val, i) => {
      doc.fontSize(8).text(val, startX + i * colWidth + 3, rowY, {
        width: colWidth - 6,
        ellipsis: true,
        lineBreak: false,
      });
    });
    doc.y = rowY + 14;
  }

  // Signatures — keep above footer band
  if (doc.y > contentBottom - 20) {
    doc.addPage();
  }
  doc.moveDown(2);
  const sigY = Math.min(doc.y + 20, size[1] - FOOTER_BAND - 70);
  doc.fontSize(9).font('Helvetica');
  doc.text('________________________', startX, sigY, { lineBreak: false });
  doc.text('Chief Judge', startX, sigY + 14, { lineBreak: false });
  if (input.branding.chiefJudgeName) {
    doc.fontSize(8).text(input.branding.chiefJudgeName, startX, sigY + 26, { lineBreak: false });
  }

  const midX = startX + usableWidth / 2;
  doc.fontSize(9).text('________________________', midX, sigY, { lineBreak: false });
  doc.text('Meet Director', midX, sigY + 14, { lineBreak: false });
  if (input.branding.directorName) {
    doc.fontSize(8).text(input.branding.directorName, midX, sigY + 26, { lineBreak: false });
  }

  // QR code
  try {
    const qr = await qrBuffer(input.branding.publicResultsUrl);
    doc.image(qr, size[0] - doc.page.margins.right - 70, sigY - 10, { width: 60 });
    doc.fontSize(7).text('Live Results', size[0] - doc.page.margins.right - 70, sigY + 52, {
      width: 60,
      align: 'center',
      lineBreak: false,
    });
  } catch {
    // QR optional if generation fails
  }

  // Footers on every page (approval + page #). Disable bottom margin so PDFKit
  // does not auto-insert a blank page when drawing in the footer band.
  const range = doc.bufferedPageRange();
  const printedAt = new Date().toISOString();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    if (input.approvalLine) {
      doc
        .fontSize(8)
        .fillColor('#111')
        .text(input.approvalLine, startX, size[1] - 48, {
          width: usableWidth,
          align: 'center',
          lineBreak: false,
        });
    } else if (input.footerNote) {
      doc
        .fontSize(8)
        .fillColor('#666')
        .text(input.footerNote, startX, size[1] - 48, {
          width: usableWidth,
          align: 'center',
          lineBreak: false,
        });
    }

    doc
      .fontSize(7)
      .fillColor('#666')
      .text(
        `Page ${i + 1} of ${range.count} · Printed ${printedAt} · FAI Sporting Code Section 7C`,
        startX,
        size[1] - 34,
        { width: usableWidth, align: 'center', lineBreak: false },
      );

    doc.page.margins.bottom = savedBottom;
  }

  doc.end();
  const buffer = await done;

  return {
    buffer,
    pageCount: range.count,
    mimeType: 'application/pdf',
  };
}

export async function generateJudgeSheetPdf(
  branding: ReportBranding,
  pilots: Array<{ pilotNumber: number; name: string; country?: string }>,
  format: PrintFormat = 'A4_PORTRAIT',
): Promise<GeneratedPdf> {
  return generateResultsPdf({
    reportType: 'JUDGE_SHEETS',
    format,
    branding,
    title: 'Blank Judge Scoring Sheet',
    subtitle: 'Record measured distance in centimetres from target centre',
    columns: ['#', 'Pilot No', 'Name', 'Country', 'Distance (cm)', 'Result', 'Notes'],
    rows: pilots.map((p, i) => ({
      rank: i + 1,
      pilotNumber: p.pilotNumber,
      name: p.name,
      country: p.country,
      scores: ['', ''],
      total: '',
    })),
    footerNote: 'Bullseye = 000 cm · Maximum = 1000 cm · DNF / ABS / DNS = Maximum',
  });
}

export async function generatePilotCardsPdf(
  branding: ReportBranding,
  pilots: Array<{
    pilotNumber: number;
    name: string;
    country?: string;
    team?: string;
    qrPayload: string;
  }>,
  format: PrintFormat = 'A4_PORTRAIT',
): Promise<GeneratedPdf> {
  // Reuse results table layout for batch pilot card listing; full card grid can extend later
  return generateResultsPdf({
    reportType: 'PILOT_CARDS',
    format,
    branding,
    title: 'Pilot Cards / Accreditation List',
    columns: ['#', 'Pilot No', 'Name', 'Country', 'Team', 'QR Ref'],
    rows: pilots.map((p, i) => ({
      rank: i + 1,
      pilotNumber: p.pilotNumber,
      name: p.name,
      country: p.country,
      team: p.team,
      scores: [p.qrPayload.slice(-12)],
      total: '',
    })),
  });
}
