import { describe, expect, it } from 'vitest';
import { rankBullseyePilots, renderBullseyeCardPng } from '../services/bullseye-og.js';

describe('bullseye share image', () => {
  it('ranks pilots by bullseye count and keeps the rounds', () => {
    const ranked = rankBullseyePilots([
      {
        totalScoreCm: 40,
        bullseyes: 1,
        pilot: { pilotNumber: 5, firstName: 'Bishal', lastName: 'Karki' },
        roundScores: [{ round: 4, isBullseye: true }],
      },
      {
        totalScoreCm: 10,
        bullseyes: 2,
        pilot: { pilotNumber: 10, firstName: 'Iska', lastName: 'Rai' },
        roundScores: [
          { round: 5, isBullseye: true },
          { round: 1, isBullseye: true },
        ],
      },
    ]);

    expect(ranked.map((pilot) => [pilot.rank, pilot.name, pilot.rounds])).toEqual([
      [1, 'Iska Rai', [1, 5]],
      [2, 'Bishal Karki', [4]],
    ]);
  });

  it('renders a PNG of the ranking card', async () => {
    const png = await renderBullseyeCardPng([
      {
        rank: 1,
        name: 'Iska Rai',
        bib: '010',
        countryCode: 'NPL',
        countryCode2: '',
        photoUrl: null,
        rounds: [1, 2],
      },
      {
        rank: 2,
        name: 'Bishal Karki',
        bib: '005',
        countryCode: '',
        countryCode2: '',
        photoUrl: null,
        rounds: [1],
      },
    ]);

    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.length).toBeGreaterThan(1000);
  });
});
