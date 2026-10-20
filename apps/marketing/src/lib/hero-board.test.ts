import { describe, expect, it } from 'vitest';
import type { PublicCompetitionList } from './api';
import {
  buildDisplaySnapshot,
  buildHeroBoard,
  featuredCompetitionCandidates,
  type HeroBoardSource,
} from './hero-board';

const list: PublicCompetitionList = {
  active: [
    {
      id: 'live',
      name: 'Open Cup',
      code: 'OC',
      organizer: 'Club',
      venue: 'Hill',
      country: '—',
      startDate: '2026-10-01T00:00:00.000Z',
      endDate: '2026-10-04T00:00:00.000Z',
      status: 'OFFICIAL',
      publicSlug: 'open-cup',
      pilotCount: 10,
      teamCount: 2,
      roundCount: 2,
      completedRounds: 1,
    },
  ],
  past: [
    {
      id: 'older',
      name: 'Older Cup',
      code: 'OLD',
      organizer: 'Club',
      venue: 'Hill',
      country: '—',
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-07-04T00:00:00.000Z',
      status: 'COMPLETED',
      publicSlug: 'older',
      pilotCount: 20,
      teamCount: 4,
      roundCount: 9,
      completedRounds: 9,
    },
    {
      id: 'recent',
      name: 'Recent Cup',
      code: 'NEW',
      organizer: 'Club',
      venue: 'Valley',
      country: '—',
      startDate: '2026-10-09T00:00:00.000Z',
      endDate: '2026-10-12T00:00:00.000Z',
      status: 'COMPLETED',
      publicSlug: 'recent',
      pilotCount: 42,
      teamCount: 10,
      roundCount: 9,
      completedRounds: 9,
    },
  ],
};

describe('featuredCompetitionCandidates', () => {
  it('prefers a live competition, then the latest completed one', () => {
    expect(featuredCompetitionCandidates(list).map((competition) => competition.id)).toEqual([
      'live',
      'recent',
      'older',
    ]);
  });
});

describe('buildHeroBoard', () => {
  const source: HeroBoardSource = {
    competition: { name: 'Recent Cup', status: 'COMPLETED' },
    rankings: [
      {
        rank: 1,
        totalScoreCm: 26,
        pilot: { pilotNumber: 4, firstName: 'Mohar', lastName: 'Singh' },
        roundScores: [
          { round: 8, scoreCm: 4 },
          { round: 9, scoreCm: 2 },
        ],
      },
      {
        rank: 2,
        totalScoreCm: 38,
        pilot: { pilotNumber: 18, firstName: 'Akshay', lastName: 'Kumar' },
        roundScores: [{ round: 9, scoreCm: 6 }],
      },
      {
        rank: 3,
        totalScoreCm: 100,
        pilot: { pilotNumber: 11, firstName: 'Aman', lastName: 'Thapa' },
        roundScores: [{ round: 9, scoreCm: 12 }],
      },
    ],
    teams: [{ rank: 1, name: 'Spehnidhar Paragliding Adventure', pilotNumbers: [4, 18] }],
    latest: { pilotNumber: 11, roundNumber: 3, scoreCm: 40 },
  };

  it('features the winner of a finished competition, not the last score entered', () => {
    const board = buildHeroBoard(source);
    expect(board?.pilotLabel).toBe('#4 · Mohar Singh');
    expect(board?.title).toBe('Final · Round 9');
    expect(board?.scoreLabel).toBe('2');
    expect(board?.overallLabel).toBe('26 cm');
    expect(board?.teamLabel).toBe('#1');
    expect(board?.rows.map((row) => row.name)).toEqual(['Mohar Singh', 'Akshay Kumar', 'Aman Thapa']);
    expect(board?.rows[0]?.highlight).toBe(true);
    expect(board?.rows[2]?.score).toBe('12');
  });

  it('features the latest landing while the competition is live', () => {
    const board = buildHeroBoard({
      ...source,
      competition: { name: 'Open Cup', status: 'OFFICIAL' },
    });
    expect(board?.title).toBe('Live · Round 3');
    expect(board?.pilotLabel).toBe('#11 · Aman Thapa');
    expect(board?.scoreLabel).toBe('40');
    expect(board?.rankLabel).toBe('#3');
  });

  it('returns nothing when there is no ranking', () => {
    expect(buildHeroBoard({ ...source, rankings: [] })).toBeNull();
  });
});

describe('buildDisplaySnapshot', () => {
  it('uses the venue-display shape for the leading pilot', () => {
    const snapshot = buildDisplaySnapshot({
      competition: { name: 'Recent Cup', status: 'COMPLETED' },
      rankings: [
        {
          rank: 1,
          totalScoreCm: 26,
          pilot: {
            pilotNumber: 4,
            firstName: 'Mohar',
            lastName: 'Singh',
            photoUrl: 'https://example.com/mohar.jpg',
            country: { code: 'IND', code2: 'IN' },
          },
          roundScores: [{ round: 9, scoreCm: 0 }],
        },
      ],
      teams: [],
      latest: null,
    });
    expect(snapshot).toMatchObject({
      pilotName: 'Mohar Singh',
      pilotNumber: '004',
      country: 'IND',
      roundLabel: '9',
      rankLabel: '#1',
      totalLabel: '026',
      scoreLabel: '000',
      bullseye: true,
    });
    expect(snapshot?.flag).toBe('🇮🇳');
  });
});
