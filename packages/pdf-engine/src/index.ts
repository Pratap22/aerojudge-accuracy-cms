/**
 * PDF Engine – official competition result sheets
 * A4 / Letter, headers, signatures, QR to live results, page numbers.
 */

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type { PrintFormat, ReportType } from '@aero-judge/shared';

export interface ReportBranding {
  competitionName: string;
  organizer: string;
  venue: string;
  country: string;
  dateLabel: string;
  roundNumber?: number;
  logoPath?: string;
  /** Local filesystem path for PDF embedding (PNG/JPEG). */
  organizerLogoPath?: string;
  /** Absolute URL for HTML preview `<img>`. */
  organizerLogoUrl?: string;
  /** Heading for the closing logo page, e.g. Sponsors or Supporters. */
  partnersLabel?: string;
  /**
   * Active partner logos. Rendered on a final page when at least one entry exists.
   * `image` is PNG or JPEG bytes for PDF embedding; `url` is used by the HTML preview.
   */
  sponsorLogoGroups?: Array<{
    /** Tier heading. Omitted when the competition does not use tiers. */
    label?: string;
    logos: Array<{ name: string; url: string; image?: Buffer }>;
  }>;
  publicResultsUrl: string;
  chiefJudgeName?: string;
  directorName?: string;
}

export interface ReportCell {
  text: string;
  excluded?: boolean;
  bold?: boolean;
  rowspan?: number;
  /** Cell covered by a rowspan from a previous row — omit in HTML / leave blank in PDF */
  skip?: boolean;
}

export type ReportScoreValue =
  | string
  | number
  | { value: string | number; excluded?: boolean };

export interface ResultRow {
  rank: number;
  pilotNumber?: number;
  name: string;
  country?: string;
  team?: string;
  scores: ReportScoreValue[];
  total: ReportScoreValue;
  notes?: string;
  rowKind?: 'default' | 'team_pilot' | 'team_total';
  /** Blank Rank/Team on continuation rows (PDF); HTML uses rowspan on first row */
  hideRank?: boolean;
  hideTeam?: boolean;
  rankRowspan?: number;
  teamRowspan?: number;
}

function scoreValueText(value: ReportScoreValue | undefined): string {
  if (value == null) return '';
  if (typeof value === 'object') return String(value.value ?? '');
  return String(value);
}

function scoreValueExcluded(value: ReportScoreValue | undefined): boolean {
  return typeof value === 'object' && Boolean(value.excluded);
}

/**
 * Map a column header to a cell value.
 * Important: do not use key.includes('rank') — "Rounds" contains "rank" and would steal the rank value.
 */
export function resolveReportCellValue(
  column: string,
  row: ResultRow,
  scoreIdx: { current: number },
): ReportCell {
  const key = column.toLowerCase().trim();

  if (key === 'rank' || key === '#' || key === 'order') {
    if (row.hideRank) return { text: '', skip: true };
    return {
      text: String(row.rank),
      bold: row.rowKind === 'team_total',
      rowspan: row.rankRowspan,
    };
  }
  if (key === 'no' || key === 'number' || key === 'pilot no' || key === 'pilot number') {
    return { text: row.pilotNumber != null ? String(row.pilotNumber) : '' };
  }
  if (key === 'team' && row.team != null) {
    if (row.hideTeam) return { text: '', skip: true };
    return {
      text: row.team,
      bold: row.rowKind === 'team_total',
      rowspan: row.teamRowspan,
    };
  }
  if (
    key === 'name' ||
    key === 'team' ||
    key === 'pilot' ||
    key === 'pilot name' ||
    key === 'metric' ||
    key === 'item'
  ) {
    return { text: row.name, bold: row.rowKind === 'team_total' };
  }
  if (key === 'country' || key.startsWith('country')) return { text: row.country ?? '' };
  if (key === 'signature' || key === 'sign' || key.includes('signature')) return { text: '' };
  if (key === 'remarks' || key === 'remark') return { text: '' };
  if (
    key === 'total' ||
    key === 'team total' ||
    key === 'value' ||
    key === 'score (cm)' ||
    key.endsWith(' total')
  ) {
    const t = row.total;
    return {
      text: scoreValueText(t),
      excluded: scoreValueExcluded(t),
      bold: row.rowKind === 'team_total' || key === 'team total',
    };
  }
  if (key === 'notes' || key === 'note') return { text: row.notes ?? '' };

  const value = row.scores?.[scoreIdx.current];
  scoreIdx.current += 1;
  return {
    text: scoreValueText(value),
    excluded: scoreValueExcluded(value),
    bold: row.rowKind === 'team_total',
  };
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
  /** Non-table layouts (pilot accreditation cards, certificates). */
  layout?: 'table' | 'pilot_cards' | 'certificates';
  cardItems?: ReportCardItem[];
  /**
   * Extra header fields on operational sheets (round, start/end time).
   * Use `blank: true` for handwritten fill-in lines.
   */
  sheetFields?: Array<{ label: string; value?: string; blank?: boolean }>;
}

/** Pilot card / certificate payload for grid and full-page layouts. */
export interface ReportCardItem {
  pilotNumber: number;
  name: string;
  country?: string;
  team?: string;
  /** Absolute URL encoded into the QR (public pilot/results link). */
  qrUrl?: string;
  rank?: number;
  totalScore?: string;
  /** Certificate headline, e.g. Certificate of Participation */
  certificateTitle?: string;
  /** Extra line under the name (placement text). */
  placementLine?: string;
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

/** Relative width weights — name/team get more room than rank/score columns. */
function columnWeight(column: string): number {
  const key = column.toLowerCase().trim();
  if (key === 'rank' || key === '#' || key === 'order') return 0.55;
  if (key === 'no' || key === 'number' || key === 'pilot no' || key === 'pilot number') return 0.65;
  if (key === 'name' || key === 'pilot name' || key === 'pilot') return 2.6;
  if (key === 'team') return 2.4;
  if (key === 'country') return 1.35;
  if (key === 'team total') return 1.05;
  if (key === 'total' || key === 'bullseyes' || key === 'value' || key === 'result') return 0.95;
  if (key.includes('distance') || key === 'score (cm)') return 1.05;
  if (key === 'notes' || key === 'note' || key === 'gender' || key === 'club' || key === 'status')
    return 1.2;
  if (key === 'remarks' || key === 'remark') return 1.6;
  if (/^r\d+$/i.test(key)) return 0.7;
  if (key.includes('signature') || key === 'sign') return 1.4;
  return 1;
}

function isWrappingColumn(column: string): boolean {
  const key = column.toLowerCase().trim();
  return (
    key === 'name' ||
    key === 'pilot name' ||
    key === 'pilot' ||
    key === 'team' ||
    key === 'country' ||
    key === 'notes' ||
    key === 'note'
  );
}

function computeColumnWidths(columns: string[], usableWidth: number): number[] {
  const weights = columns.map(columnWeight);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((w) => (w / sum) * usableWidth);
}

function measureWrappedHeight(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  fontSize: number,
  bold: boolean,
): number {
  if (!text) return fontSize + 4;
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
  const height = doc.heightOfString(text, { width: Math.max(width, 8), lineGap: 1 });
  return Math.max(fontSize + 4, height + 2);
}

function sponsorLogosWithImages(input: GenerateReportInput) {
  return (input.branding.sponsorLogoGroups ?? [])
    .flatMap((group) => group.logos)
    .filter((logo) => logo.image && logo.image.length > 0);
}

/**
 * Partner logos after the report body. Continues on the current page when the
 * row fits above the footer; otherwise the overflow starts on the next page.
 * Logos without image bytes are omitted. No heading or name is printed.
 */
function drawSponsorLogos(doc: PDFKit.PDFDocument, input: GenerateReportInput): void {
  const logos = sponsorLogosWithImages(input);
  if (logos.length === 0) return;

  const size = pageSize(input.format);
  const marginL = doc.page.margins.left;
  const usable = size[0] - marginL - doc.page.margins.right;
  const bottom = size[1] - doc.page.margins.bottom - 8;
  const boxW = 120;
  const imgH = 64;
  const gapX = 28;
  const gapY = 16;
  const cols = Math.max(1, Math.min(4, Math.floor((usable + gapX) / (boxW + gapX))));

  let y = doc.y + 18;

  const nextPage = () => {
    doc.addPage();
    y = doc.page.margins.top;
  };

  for (let i = 0; i < logos.length; i += cols) {
    if (y + imgH > bottom) nextPage();
    const row = logos.slice(i, i + cols);
    const rowW = row.length * boxW + (row.length - 1) * gapX;
    let x = marginL + Math.max(0, (usable - rowW) / 2);
    for (const logo of row) {
      if (!logo.image) continue;
      try {
        doc.image(logo.image, x, y, {
          fit: [boxW, imgH],
          align: 'center',
          valign: 'center',
        });
      } catch {
        // Unsupported bytes — leave the slot empty rather than printing a name.
      }
      x += boxW + gapX;
    }
    y += imgH + gapY;
  }

  doc.y = y;
  doc.fillColor('#000');
}

export async function generateResultsPdf(input: GenerateReportInput): Promise<GeneratedPdf> {
  const size = pageSize(input.format);
  /** Reserved band at page bottom for approval + page numbers (outside content flow). */
  const FOOTER_BAND = 56;
  const doc = new PDFDocument({
    size,
    margins: { top: 50, bottom: FOOTER_BAND + 8, left: 36, right: 36 },
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

  // Header — organiser logo top-right when available (PNG/JPEG; SVG/WebP skipped)
  const headerTop = doc.y;
  const logoPath = input.branding.organizerLogoPath;
  if (logoPath && /\.(png|jpe?g)$/i.test(logoPath)) {
    try {
      const logoBoxW = 80;
      const logoBoxH = 52;
      const logoX = size[0] - doc.page.margins.right - logoBoxW;
      doc.image(logoPath, logoX, headerTop, { fit: [logoBoxW, logoBoxH] });
    } catch {
      // Missing or unsupported image — continue without logo
    }
    doc.y = headerTop;
  }

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

  // Operational sheet fields (Round, Start Time, End Time, …)
  if (input.sheetFields && input.sheetFields.length > 0) {
    doc.moveDown(0.5);
    const fieldY = doc.y;
    const fieldGap = 12;
    const fieldCount = input.sheetFields.length;
    const fieldsWidth = size[0] - doc.page.margins.left - doc.page.margins.right;
    const fieldW = (fieldsWidth - fieldGap * (fieldCount - 1)) / fieldCount;
    let fieldX = doc.page.margins.left;
    for (const field of input.sheetFields) {
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#111').text(field.label, fieldX, fieldY, {
        width: fieldW,
        lineBreak: false,
      });
      const boxY = fieldY + 14;
      doc.rect(fieldX, boxY, fieldW, 18).strokeColor('#94a3b8').lineWidth(0.8).stroke();
      if (!field.blank && field.value) {
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#1a365d')
          .text(field.value, fieldX + 6, boxY + 4, {
            width: fieldW - 12,
            lineBreak: false,
          });
      }
      fieldX += fieldW + fieldGap;
    }
    doc.strokeColor('#000').lineWidth(1);
    doc.y = fieldY + 40;
  } else if (input.branding.roundNumber != null) {
    doc.fontSize(10).text(`Round ${input.branding.roundNumber}`, { align: 'center' });
    doc.moveDown(0.8);
  } else {
    doc.moveDown(0.8);
  }

  // Table header
  const startX = doc.page.margins.left;
  const usableWidth = size[0] - doc.page.margins.left - doc.page.margins.right;
  const colWidths = computeColumnWidths(input.columns, usableWidth);
  const colXs = colWidths.reduce<number[]>((acc, _w, i) => {
    acc.push(i === 0 ? startX : acc[i - 1] + colWidths[i - 1]);
    return acc;
  }, []);
  const contentBottom = size[1] - FOOTER_BAND - 90;
  const FONT_SIZE = 8;

  const drawTableHeader = () => {
    const y = doc.y;
    const headerH = Math.max(
      18,
      ...input.columns.map((col, i) =>
        measureWrappedHeight(doc, col, colWidths[i] - 6, FONT_SIZE, true),
      ),
    );
    doc.rect(startX, y, usableWidth, headerH + 4).fill('#1a365d');
    doc.fillColor('#fff').fontSize(FONT_SIZE).font('Helvetica-Bold');
    input.columns.forEach((col, i) => {
      doc.text(col, colXs[i] + 3, y + 3, {
        width: colWidths[i] - 6,
        lineGap: 1,
      });
    });
    doc.fillColor('#000').font('Helvetica');
    doc.y = y + headerH + 6;
  };

  drawTableHeader();

  for (const row of input.rows) {
    const scoreIdx = { current: 0 };
    const cells = input.columns.map((col) => resolveReportCellValue(col, row, scoreIdx));

    let rowH = row.rowKind === 'team_total' ? 16 : 14;
    const hasWritableCols = input.columns.some((c) => {
      const key = c.toLowerCase().trim();
      return (
        key.includes('signature') ||
        key === 'sign' ||
        key === 'remarks' ||
        key === 'remark' ||
        key === 'notes'
      );
    });
    if (hasWritableCols) rowH = Math.max(rowH, 22);
    input.columns.forEach((col, i) => {
      const cell = cells[i];
      if (cell.skip || !cell.text) return;
      if (!isWrappingColumn(col) && !cell.excluded) return;
      if (isWrappingColumn(col)) {
        const h = measureWrappedHeight(
          doc,
          cell.text,
          colWidths[i] - 6,
          FONT_SIZE,
          Boolean(cell.bold),
        );
        rowH = Math.max(rowH, h + 4);
      }
    });

    if (doc.y + rowH > contentBottom) {
      doc.addPage();
      drawTableHeader();
    }

    const rowY = doc.y;

    if (row.rowKind === 'team_total') {
      doc.rect(startX, rowY - 1, usableWidth, rowH).fill('#e8eef5');
      doc.fillColor('#000');
    } else if (row.rank % 2 === 0) {
      doc.rect(startX, rowY - 1, usableWidth, rowH).fill('#f7fafc');
      doc.fillColor('#000');
    }

    cells.forEach((cell, i) => {
      if (cell.skip) return;
      const x = colXs[i] + 3;
      const w = colWidths[i] - 6;
      const wrap = isWrappingColumn(input.columns[i]);

      if (cell.excluded) {
        doc.rect(colXs[i] + 1, rowY, colWidths[i] - 2, rowH - 1).fill('#d1d5db');
        doc.fillColor('#4b5563');
      } else {
        doc.fillColor('#000');
      }

      doc.font(cell.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT_SIZE);
      // PDFKit advances doc.y on wrapped text — pin Y so sibling cells stay aligned.
      if (wrap) {
        doc.text(cell.text, x, rowY + 2, {
          width: w,
          lineGap: 1,
        });
        doc.y = rowY;
      } else {
        doc.text(cell.text, x, rowY + 2, {
          width: w,
          ellipsis: true,
          lineBreak: false,
        });
        doc.y = rowY;
        if (cell.excluded && cell.text) {
          const tw = Math.min(doc.widthOfString(cell.text), w);
          doc
            .moveTo(x, rowY + 7)
            .lineTo(x + tw, rowY + 7)
            .strokeColor('#4b5563')
            .lineWidth(0.8)
            .stroke();
          doc.strokeColor('#000').lineWidth(1);
        }
      }
    });
    doc.fillColor('#000').font('Helvetica');
    doc.y = rowY + rowH;
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

  doc.y = sigY + 72;
  drawSponsorLogos(doc, input);

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
        `Page ${i + 1} of ${range.count} · Printed ${printedAt} · FAI Sporting Code Section 7C · Generated by AeroJudge`,
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
    columns: ['#', 'No', 'Name', 'Country', 'Distance (cm)', 'Result', 'Notes'],
    rows: pilots.map((p, i) => ({
      rank: i + 1,
      pilotNumber: p.pilotNumber,
      name: p.name,
      country: p.country,
      scores: ['', ''],
      total: '',
    })),
    footerNote: 'Bullseye = 000 cm · Maximum applies for DNF / ABS / DNS',
  });
}

/**
 * Dispatch PDF generation by report layout / type.
 */
export async function generateReportPdf(input: GenerateReportInput): Promise<GeneratedPdf> {
  const layout =
    input.layout ??
    (input.reportType === 'PILOT_CARDS'
      ? 'pilot_cards'
      : input.reportType === 'CERTIFICATES'
        ? 'certificates'
        : 'table');

  if (layout === 'pilot_cards') {
    return generatePilotCardsPdf(input);
  }
  if (layout === 'certificates') {
    return generateCertificatesPdf(input);
  }
  return generateResultsPdf(input);
}

export async function generatePilotCardsPdf(input: GenerateReportInput): Promise<GeneratedPdf> {
  const items =
    input.cardItems ??
    input.rows.map((r) => ({
      pilotNumber: r.pilotNumber ?? r.rank,
      name: r.name,
      country: r.country,
      team: r.team,
      qrUrl: typeof r.scores?.[0] === 'string' ? r.scores[0] : undefined,
    }));

  const size = pageSize(input.format);
  const doc = new PDFDocument({
    size,
    margins: { top: 36, bottom: 36, left: 36, right: 36 },
    bufferPages: true,
    info: {
      Title: input.title,
      Author: input.branding.organizer,
      Subject: `${input.branding.competitionName} – Pilot Cards`,
      Creator: 'AeroJudge',
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const margin = 36;
  const gap = 12;
  const cols = size[0] > size[1] ? 3 : 2;
  const rowsPerPage = size[0] > size[1] ? 2 : 4;
  const cardW = (size[0] - margin * 2 - gap * (cols - 1)) / cols;
  const cardH = (size[1] - margin * 2 - 48 - gap * (rowsPerPage - 1)) / rowsPerPage;
  const perPage = cols * rowsPerPage;

  const drawHeader = () => {
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#000')
      .text(input.branding.competitionName, margin, margin, {
        width: size[0] - margin * 2,
        align: 'center',
      });
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(input.title, { align: 'center' });
    doc.moveDown(0.4);
  };

  for (let i = 0; i < items.length; i++) {
    const indexOnPage = i % perPage;
    if (indexOnPage === 0) {
      if (i > 0) doc.addPage();
      drawHeader();
    }

    const col = indexOnPage % cols;
    const row = Math.floor(indexOnPage / cols);
    const headerOffset = 42;
    const x = margin + col * (cardW + gap);
    const y = margin + headerOffset + row * (cardH + gap);
    const item = items[i]!;

    doc.roundedRect(x, y, cardW, cardH, 6).lineWidth(1).strokeColor('#1a365d').stroke();
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#1a365d')
      .text(String(item.pilotNumber).padStart(3, '0'), x + 10, y + 12, {
        width: cardW - 90,
        lineBreak: false,
      });
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#000')
      .text(item.name, x + 10, y + 40, { width: cardW - 90 });
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#444')
      .text(item.country ?? '', x + 10, y + 58, { width: cardW - 90 });
    if (item.team) {
      doc.text(item.team, x + 10, y + 72, { width: cardW - 90 });
    }
    doc
      .fontSize(7)
      .fillColor('#666')
      .text(input.branding.organizer, x + 10, y + cardH - 22, {
        width: cardW - 90,
        lineBreak: false,
      });

    const qrUrl = item.qrUrl || input.branding.publicResultsUrl;
    try {
      const qr = await qrBuffer(qrUrl);
      doc.image(qr, x + cardW - 72, y + 12, { width: 56 });
    } catch {
      // QR optional
    }
  }

  if (items.length === 0) {
    drawHeader();
    doc.fontSize(11).fillColor('#666').text('No registered pilots.', { align: 'center' });
  } else {
    const lastIndex = (items.length - 1) % perPage;
    const lastRow = Math.floor(lastIndex / cols);
    doc.y = margin + 42 + lastRow * (cardH + gap) + cardH;
  }

  drawSponsorLogos(doc, input);

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(7)
      .fillColor('#666')
      .text(
        `Page ${i + 1} of ${range.count} · Generated by AeroJudge`,
        margin,
        size[1] - 28,
        { width: size[0] - margin * 2, align: 'center', lineBreak: false },
      );
  }

  doc.end();
  const buffer = await done;
  return { buffer, pageCount: Math.max(range.count, 1), mimeType: 'application/pdf' };
}

export async function generateCertificatesPdf(input: GenerateReportInput): Promise<GeneratedPdf> {
  const items =
    input.cardItems ??
    input.rows.map((r) => ({
      pilotNumber: r.pilotNumber ?? r.rank,
      name: r.name,
      country: r.country,
      team: r.team,
      rank: r.rank,
      totalScore: scoreValueText(r.total),
      certificateTitle: 'Certificate of Participation',
      placementLine: r.notes,
      qrUrl: input.branding.publicResultsUrl,
    }));

  const size = pageSize(input.format);
  const doc = new PDFDocument({
    size,
    margins: { top: 48, bottom: 48, left: 48, right: 48 },
    bufferPages: true,
    info: {
      Title: input.title,
      Author: input.branding.organizer,
      Subject: `${input.branding.competitionName} – Certificates`,
      Creator: 'AeroJudge',
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const innerPad = 28;

  for (let i = 0; i < items.length; i++) {
    if (i > 0) doc.addPage();
    const item = items[i]!;
    const x = 48;
    const y = 48;
    const w = size[0] - 96;
    const h = size[1] - 96;

    doc.roundedRect(x, y, w, h, 8).lineWidth(2).strokeColor('#1a365d').stroke();
    doc
      .roundedRect(x + 8, y + 8, w - 16, h - 16, 4)
      .lineWidth(0.8)
      .strokeColor('#94a3b8')
      .stroke();

    const cx = size[0] / 2;
    let cursorY = y + innerPad + 24;

    const logoPath = input.branding.organizerLogoPath;
    if (logoPath && /\.(png|jpe?g)$/i.test(logoPath)) {
      try {
        doc.image(logoPath, cx - 36, cursorY, { fit: [72, 48] });
        cursorY += 56;
      } catch {
        // skip logo
      }
    }

    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#64748b')
      .text(input.branding.organizer.toUpperCase(), x + innerPad, cursorY, {
        width: w - innerPad * 2,
        align: 'center',
      });
    cursorY += 28;

    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .fillColor('#1a365d')
      .text(item.certificateTitle ?? 'Certificate of Participation', x + innerPad, cursorY, {
        width: w - innerPad * 2,
        align: 'center',
      });
    cursorY += 40;

    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#334155')
      .text('This certifies that', x + innerPad, cursorY, {
        width: w - innerPad * 2,
        align: 'center',
      });
    cursorY += 28;

    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text(item.name, x + innerPad, cursorY, {
        width: w - innerPad * 2,
        align: 'center',
      });
    cursorY += 28;

    const meta = [
      item.country,
      item.team,
      item.pilotNumber != null ? `Pilot No. ${String(item.pilotNumber).padStart(3, '0')}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    if (meta) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#64748b')
        .text(meta, x + innerPad, cursorY, { width: w - innerPad * 2, align: 'center' });
      cursorY += 22;
    }

    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#334155')
      .text(`participated in ${input.branding.competitionName}`, x + innerPad, cursorY, {
        width: w - innerPad * 2,
        align: 'center',
      });
    cursorY += 20;
    doc.text(
      `${input.branding.venue}, ${input.branding.country} · ${input.branding.dateLabel}`,
      x + innerPad,
      cursorY,
      { width: w - innerPad * 2, align: 'center' },
    );
    cursorY += 28;

    if (item.placementLine) {
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1a365d')
        .text(item.placementLine, x + innerPad, cursorY, {
          width: w - innerPad * 2,
          align: 'center',
        });
      cursorY += 24;
    }

    if (item.totalScore) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#475569')
        .text(`Total score: ${item.totalScore} cm`, x + innerPad, cursorY, {
          width: w - innerPad * 2,
          align: 'center',
        });
      cursorY += 20;
    }

    const sigY = y + h - 100;
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#000')
      .text('________________________', x + 40, sigY, { lineBreak: false });
    doc.text('Meet Director', x + 40, sigY + 14, { lineBreak: false });
    if (input.branding.directorName) {
      doc.fontSize(8).text(input.branding.directorName, x + 40, sigY + 26, { lineBreak: false });
    }

    doc
      .fontSize(9)
      .text('________________________', x + w - 200, sigY, { lineBreak: false });
    doc.text('Chief Judge', x + w - 200, sigY + 14, { lineBreak: false });
    if (input.branding.chiefJudgeName) {
      doc
        .fontSize(8)
        .text(input.branding.chiefJudgeName, x + w - 200, sigY + 26, { lineBreak: false });
    }

    try {
      const qr = await qrBuffer(item.qrUrl || input.branding.publicResultsUrl);
      doc.image(qr, cx - 24, sigY - 8, { width: 48 });
    } catch {
      // optional
    }

    if (input.approvalLine) {
      doc
        .fontSize(8)
        .fillColor('#111')
        .text(input.approvalLine, x + innerPad, y + h - 28, {
          width: w - innerPad * 2,
          align: 'center',
          lineBreak: false,
        });
    }
  }

  if (items.length === 0) {
    doc
      .fontSize(12)
      .fillColor('#666')
      .text('No pilots available for certificates.', 48, size[1] / 2, {
        width: size[0] - 96,
        align: 'center',
      });
  } else {
    // Each certificate fills its page, so logos follow on the next page.
    doc.y = size[1];
  }

  drawSponsorLogos(doc, input);

  const range = doc.bufferedPageRange();
  doc.end();
  const buffer = await done;
  return { buffer, pageCount: Math.max(range.count, 1), mimeType: 'application/pdf' };
}
