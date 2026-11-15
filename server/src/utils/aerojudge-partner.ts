import { env } from '../config/env.js';
import { toAbsoluteAssetUrl } from './assets.js';

/** Stable synthetic id — not a DB row. */
export const AEROJUDGE_PARTNER_ID = 'aerojudge-platform';

const AEROJUDGE_NAME = 'AeroJudge';
const LOGO_PATH = '/branding/aerojudge-logo.png';

function productSiteUrl(): string {
  try {
    return new URL(env.PUBLIC_RESULTS_URL).origin;
  } catch {
    return env.publicApiUrl;
  }
}

/** True when the organiser already listed AeroJudge as a partner. */
export function hasAeroJudgePartner(partners: { name: string }[]): boolean {
  return partners.some((p) => p.name.trim().toLowerCase() === AEROJUDGE_NAME.toLowerCase());
}

/**
 * Virtual STANDARD partner for public / venue lists.
 * Included by default; competitions can opt out via settings.aeroJudgeAsPartner.
 */
export function buildAeroJudgePartner(competitionId: string) {
  return {
    id: AEROJUDGE_PARTNER_ID,
    competitionId,
    name: AEROJUDGE_NAME,
    type: 'STANDARD' as const,
    logoUrl: toAbsoluteAssetUrl(LOGO_PATH),
    websiteUrl: productSiteUrl(),
    displayOrder: 10_000,
    isActive: true,
  };
}

/** Append AeroJudge when the setting allows and it is not already listed. */
export function withAeroJudgePartner<T extends { name: string }>(
  partners: T[],
  opts: { competitionId: string; enabled: boolean },
): Array<T | ReturnType<typeof buildAeroJudgePartner>> {
  if (!opts.enabled || hasAeroJudgePartner(partners)) return partners;
  return [...partners, buildAeroJudgePartner(opts.competitionId)];
}
