import { describe, expect, it } from 'vitest';
import { aeroJudgeApps } from './apps';
import { availableFeatures, features } from './features';

describe('marketing config integrity', () => {
  it('exposes only real sub-apps', () => {
    const ids = aeroJudgeApps.map((a) => a.id);
    expect(ids).toEqual(['admin', 'judge', 'events', 'display']);
  });

  it('does not market planned features as available', () => {
    for (const feature of availableFeatures) {
      expect(feature.status).toBe('AVAILABLE');
    }
    const plannedAsAvailable = features.filter(
      (f) => f.status === 'PLANNED' && availableFeatures.some((a) => a.id === f.id),
    );
    expect(plannedAsAvailable).toHaveLength(0);
  });
});
