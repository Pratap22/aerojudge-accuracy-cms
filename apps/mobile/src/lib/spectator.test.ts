import { computeFlightScore } from '@aero-judge/scoring-engine';
import { DEFAULT_FAI_2022_RULES } from '@aero-judge/shared';
import { describe, expect, it } from 'vitest';
import { competitionTargetFromUrl, hrefForCompetitionTarget } from './links';
import { ApiError, publicApiUrl, readApiData, resolveApiBaseUrl } from './public-api';
import {
  competitionMatchesQuery,
  formatEventDate,
  formatEventRange,
  formatRankingScore,
  rankingEntryName,
  resultsStatusLine,
  visibleRankings,
} from './results';
import type { PublicRankingRow } from './types';

const EXAMPLE =
  'https://aerojudge.nepalabs.com/display/competition/cmsdgtqyw000h9wgn9jay0tkw?layout=top10';

function row(
  partial: Partial<PublicRankingRow> & Pick<PublicRankingRow, 'id' | 'rank'>,
): PublicRankingRow {
  return {
    totalScoreCm: 0,
    roundsFlown: 0,
    bullseyes: 0,
    ...partial,
  };
}

describe('public API helpers', () => {
  it('builds a public results URL from the API origin', () => {
    expect(
      publicApiUrl('https://aerojudge.nepalabs.com/', '/cmsdgtqyw000h9wgn9jay0tkw/results', {
        category: 'OVERALL',
      }),
    ).toBe(
      'https://aerojudge.nepalabs.com/api/v1/public/cmsdgtqyw000h9wgn9jay0tkw/results?category=OVERALL',
    );
  });

  it('rejects a missing API origin', () => {
    expect(() => resolveApiBaseUrl('  ')).toThrow(ApiError);
  });

  it('reads a successful envelope and surfaces API errors', () => {
    expect(readApiData(200, { success: true, data: { active: [], past: [] } })).toEqual({
      active: [],
      past: [],
    });
    expect(() =>
      readApiData(403, {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Public results are not enabled for this competition',
        },
      }),
    ).toThrow('Public results are not enabled for this competition');
  });
});

describe('competition links', () => {
  it('maps the venue display URL onto the native competition board', () => {
    const target = competitionTargetFromUrl(EXAMPLE);
    expect(target).toEqual({
      competitionId: 'cmsdgtqyw000h9wgn9jay0tkw',
      layout: 'top10',
      results: false,
    });
    expect(target && hrefForCompetitionTarget(target)).toBe(
      '/competition/cmsdgtqyw000h9wgn9jay0tkw?layout=top10',
    );
  });

  it('maps Events results and the app scheme', () => {
    expect(
      competitionTargetFromUrl('https://aerojudge.nepalabs.com/events/competition/abc/results'),
    ).toEqual({ competitionId: 'abc', layout: null, results: true });
    expect(competitionTargetFromUrl('aerojudge://competition/abc?layout=top10')).toEqual({
      competitionId: 'abc',
      layout: 'top10',
      results: false,
    });
    expect(competitionTargetFromUrl('aerojudge://display/competition/abc')).toEqual({
      competitionId: 'abc',
      layout: null,
      results: false,
    });
  });

  it('ignores website paths that are not a competition board', () => {
    expect(competitionTargetFromUrl('https://aerojudge.nepalabs.com/')).toBeNull();
    expect(
      competitionTargetFromUrl('https://aerojudge.nepalabs.com/events/competition/abc/pilots'),
    ).toBeNull();
  });
});

describe('standings presentation', () => {
  it('limits a top10 layout and keeps the full list otherwise', () => {
    const rows = Array.from({ length: 12 }, (_, index) => index + 1);
    expect(visibleRankings(rows, 'top10')).toHaveLength(10);
    expect(visibleRankings(rows, 'women')).toHaveLength(12);
    expect(visibleRankings(rows, null)).toBe(rows);
  });

  it('names pilots, teams, and countries from the public payload', () => {
    expect(
      rankingEntryName(
        row({
          id: '1',
          rank: 1,
          pilot: { pilotNumber: 7, firstName: 'Ada', lastName: 'Lovelace', country: null },
        }),
      ),
    ).toBe('Ada Lovelace');
    expect(rankingEntryName(row({ id: '2', rank: 2, team: { id: 't', name: 'Club Team' } }))).toBe(
      'Club Team',
    );
  });

  it('pads scores with the shared formatter and does not call cached data live', () => {
    expect(formatRankingScore(11)).toBe('011');
    expect(formatRankingScore(0)).toBe('000');
    const stale = resultsStatusLine({
      official: false,
      completed: false,
      stale: true,
      live: true,
      fetchedAtLabel: '11 Oct, 06:40',
    });
    expect(stale).toContain("Couldn't refresh");
    expect(stale.toLowerCase()).not.toContain('live');
    expect(
      resultsStatusLine({
        official: false,
        completed: false,
        stale: false,
        live: true,
        fetchedAtLabel: '11 Oct, 06:40',
      }),
    ).toBe('Provisional results · Live · Updated 11 Oct, 06:40');
    expect(
      resultsStatusLine({
        official: true,
        completed: true,
        stale: false,
        live: true,
        fetchedAtLabel: '11 Oct, 06:40',
      }),
    ).toBe('Official final standings · Updated 11 Oct, 06:40');
  });

  it('uses the shared scoring engine for a bullseye', () => {
    const result = computeFlightScore(
      { pilotId: 'p1', roundId: 'r1', distanceCm: 0, resultType: 'BULLSEYE' },
      DEFAULT_FAI_2022_RULES,
    );
    expect(result.finalScoreCm).toBe(0);
    expect(formatRankingScore(result.finalScoreCm)).toBe('000');
  });

  it('filters competitions locally and keeps invalid dates readable', () => {
    const competition = {
      name: 'Accuracy Open',
      venue: 'Hill Field',
      country: 'Sampleland',
      code: 'AO-2026',
      organizer: 'Sample Club',
    };
    expect(competitionMatchesQuery(competition, 'hill')).toBe(true);
    expect(competitionMatchesQuery(competition, 'missing')).toBe(false);
    expect(formatEventDate('not-a-date')).toBe('not-a-date');
    expect(formatEventRange('2026-06-15', '2026-06-15')).not.toContain('–');
  });
});
