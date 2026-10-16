import { describe, expect, it } from 'vitest';
import { generateReportPdf, type ReportBranding } from './index';

const branding: ReportBranding = {
  competitionName: 'Sample Cup',
  organizer: 'Organiser',
  venue: 'Venue',
  country: 'Country',
  dateLabel: '2026-01-01 – 2026-01-02',
  publicResultsUrl: 'https://example.com/results',
};

describe('multi-round results PDF', () => {
  it('starts each selected round on its own page', async () => {
    const pdf = await generateReportPdf({
      reportType: 'ROUND_RESULTS',
      format: 'A4_PORTRAIT',
      branding,
      title: 'Round Results',
      columns: ['Rank', 'Name', 'Score (cm)'],
      rows: [],
      sections: [
        {
          title: 'Round 1 Results',
          roundNumber: 1,
          columns: ['Rank', 'Name', 'Score (cm)'],
          rows: [{ rank: 1, name: 'Pilot A', scores: [], total: 0 }],
        },
        {
          title: 'Round 2 Results',
          roundNumber: 2,
          columns: ['Rank', 'Name', 'Score (cm)'],
          rows: [{ rank: 1, name: 'Pilot B', scores: [], total: 4 }],
        },
      ],
    });

    expect(pdf.mimeType).toBe('application/pdf');
    expect(pdf.buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.pageCount).toBeGreaterThanOrEqual(2);
  });
});
