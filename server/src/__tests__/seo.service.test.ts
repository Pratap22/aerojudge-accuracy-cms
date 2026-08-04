import { describe, expect, it } from 'vitest';
import { normalizePublicPath } from '../services/seo.service.js';

describe('normalizePublicPath', () => {
  it('strips /events prefix', () => {
    expect(normalizePublicPath('/events/competition/abc/results')).toBe(
      '/competition/abc/results',
    );
    expect(normalizePublicPath('/events/')).toBe('/');
    expect(normalizePublicPath('/events')).toBe('/');
  });

  it('strips legacy /results prefix', () => {
    expect(normalizePublicPath('/results/competition/abc/results')).toBe(
      '/competition/abc/results',
    );
    expect(normalizePublicPath('/results/')).toBe('/');
    expect(normalizePublicPath('/results')).toBe('/');
  });

  it('keeps competition paths without prefix', () => {
    expect(normalizePublicPath('/competition/abc')).toBe('/competition/abc');
  });

  it('strips query and trailing slash', () => {
    expect(normalizePublicPath('/events/competition/abc/?utm=1')).toBe('/competition/abc');
    expect(normalizePublicPath('/results/competition/abc/?utm=1')).toBe('/competition/abc');
  });
});
