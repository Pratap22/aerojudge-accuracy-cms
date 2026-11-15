import { describe, expect, it } from 'vitest';
import {
  AEROJUDGE_PARTNER_ID,
  buildAeroJudgePartner,
  hasAeroJudgePartner,
  withAeroJudgePartner,
} from '../utils/aerojudge-partner.js';

describe('aerojudge partner', () => {
  it('detects an existing AeroJudge listing', () => {
    expect(hasAeroJudgePartner([{ name: 'AeroJudge' }])).toBe(true);
    expect(hasAeroJudgePartner([{ name: '  aerojudge  ' }])).toBe(true);
    expect(hasAeroJudgePartner([{ name: 'Other' }])).toBe(false);
  });

  it('appends AeroJudge when enabled and missing', () => {
    const result = withAeroJudgePartner([{ name: 'Local Club', id: '1' } as never], {
      competitionId: 'comp1',
      enabled: true,
    });
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      id: AEROJUDGE_PARTNER_ID,
      name: 'AeroJudge',
      competitionId: 'comp1',
      type: 'STANDARD',
    });
  });

  it('skips when opted out or already listed', () => {
    expect(
      withAeroJudgePartner([{ name: 'Local Club' }], {
        competitionId: 'comp1',
        enabled: false,
      }),
    ).toEqual([{ name: 'Local Club' }]);

    expect(
      withAeroJudgePartner([{ name: 'AeroJudge' }], {
        competitionId: 'comp1',
        enabled: true,
      }),
    ).toEqual([{ name: 'AeroJudge' }]);
  });

  it('builds a public logo URL', () => {
    const partner = buildAeroJudgePartner('comp1');
    expect(partner.logoUrl).toMatch(/\/branding\/aerojudge-logo\.png$/);
    expect(partner.websiteUrl).toBeTruthy();
  });
});
