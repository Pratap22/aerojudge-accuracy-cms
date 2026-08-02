import { prisma } from '../config/prisma.js';

type CountryRow = { id: string; code: string; code2: string; name: string };

let cache: CountryRow[] | null = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

async function loadCountries(): Promise<CountryRow[]> {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_MS) return cache;
  cache = await prisma.country.findMany({
    select: { id: true, code: true, code2: true, name: true },
  });
  cacheAt = now;
  return cache;
}

/** Match Country by ISO alpha-2/3 or English name (case-insensitive). */
export async function resolveCountry(hint: string | null | undefined): Promise<CountryRow | null> {
  const raw = hint?.trim();
  if (!raw) return null;
  const countries = await loadCountries();
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();

  return (
    countries.find((c) => c.code2.toUpperCase() === upper) ??
    countries.find((c) => c.code.toUpperCase() === upper) ??
    countries.find((c) => c.name.toLowerCase() === lower) ??
    null
  );
}

export async function resolveCountryId(hint: string | null | undefined): Promise<string | null> {
  const country = await resolveCountry(hint);
  return country?.id ?? null;
}

/**
 * Link pilots that have nationality text but no countryId.
 * Returns how many rows were updated.
 */
export async function linkPilotsToCountries(competitionId: string): Promise<number> {
  const pilots = await prisma.pilot.findMany({
    where: {
      competitionId,
      countryId: null,
      nationality: { not: null },
    },
    select: { id: true, nationality: true },
  });

  let updated = 0;
  for (const pilot of pilots) {
    const countryId = await resolveCountryId(pilot.nationality);
    if (!countryId) continue;
    await prisma.pilot.update({
      where: { id: pilot.id },
      data: { countryId },
    });
    updated += 1;
  }
  return updated;
}

/** Public/API shape: `code` is always flag-ready alpha-2 when available. */
export function toPublicCountry(country: {
  name: string;
  code: string;
  code2?: string | null;
} | null) {
  if (!country) return null;
  const code2 = country.code2 || (country.code.length === 2 ? country.code : null);
  return {
    name: country.name,
    code: code2 || country.code,
    code2: code2 || country.code,
  };
}
