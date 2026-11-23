import { describe, expect, it } from 'vitest';
import { renderRankingCardPng } from '../services/ranking-og.js';

describe('ranking share image', () => {
  it('draws a result card as a PNG', async () => {
    const png = await renderRankingCardPng({
      place: 1,
      board: 'OVERALL',
      name: 'Pawan Pariyar',
      teamName: 'Team Everest',
      scoreText: '042 cm',
      pilotNumber: 25,
      countryCode: null,
      photoUrl: null,
      competitionName: 'Accuracy Cup',
    });
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.length).toBeGreaterThan(1000);
  });
});
