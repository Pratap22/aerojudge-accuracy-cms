import { describe, expect, it } from 'vitest';
import type { PricingTier, PriceDisplay } from './pricing';
import { formatPrice, pricingConfig } from './pricing';
import { availableFeatures, features } from './features';
import { aeroJudgeApps } from './apps';

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

  it('keeps pricing amounts unset until commercial terms exist', () => {
    for (const tier of pricingConfig.tiers) {
      expect(tier.price.kind).not.toBe('amount');
    }
  });

  it('formats free and contact prices for display', () => {
    expect(formatPrice({ kind: 'free' })).toBe('Free');
    expect(formatPrice({ kind: 'contact' })).toBe('Contact Us');
    expect(formatPrice({ kind: 'coming_soon' })).toBe('Coming Soon');
  });

  it('supports future amount pricing without UI rewrites', () => {
    const amount: PriceDisplay = {
      kind: 'amount',
      amount: 99,
      currency: 'USD',
      interval: 'month',
    };
    expect(formatPrice(amount)).toContain('99');
    const tiers: PricingTier[] = pricingConfig.tiers;
    expect(tiers.map((t) => t.planKey)).toEqual(['FREE', 'PROFESSIONAL', 'ENTERPRISE']);
  });
});
