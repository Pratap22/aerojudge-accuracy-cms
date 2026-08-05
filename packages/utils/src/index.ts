/** Shared utility helpers for AeroJudge */

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateCompetitionCode(name: string, year?: number): string {
  const y = year ?? new Date().getFullYear();
  const parts = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w.slice(0, 4));
  return `${parts.join('-')}-${y}`;
}

/**
 * Format a score/distance in centimetres for display.
 * Always zero-pads to at least 3 digits so pilots/organisers see consistent values
 * (0 → "000", 11 → "011", 142 → "142", 1000 → "1000").
 *
 * Second argument may be a maximum (legacy) or options object.
 */
export function formatScoreCm(
  cm: number | null | undefined,
  options?: number | { maximum?: number; width?: number },
): string {
  const opts =
    typeof options === 'number'
      ? { maximum: options, width: 3 }
      : { maximum: options?.maximum, width: options?.width ?? 3 };

  if (cm === null || cm === undefined || Number.isNaN(Number(cm))) return '—';

  let value = Number(cm);
  if (opts.maximum != null && value >= opts.maximum) {
    value = opts.maximum;
  }

  const width = opts.width ?? 3;
  if (Number.isInteger(value)) {
    return String(value).padStart(width, '0');
  }

  const [intPart, frac] = value.toFixed(1).split('.');
  return `${intPart.padStart(width, '0')}.${frac}`;
}

/** @deprecated Prefer formatScoreCm — kept as a clear alias for UI call sites. */
export const formatScore = formatScoreCm;

export function formatPilotName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export function padPilotNumber(n: number, width = 3): string {
  return String(n).padStart(width, '0');
}

export function shuffleArray<T>(items: T[], seed?: number): T[] {
  const arr = [...items];
  let s = seed ?? Date.now();
  const random = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateQrPayload(
  publicResultsUrl: string,
  competitionSlug: string,
  path = '',
): string {
  const base = publicResultsUrl.replace(/\/$/, '');
  return `${base}/${competitionSlug}${path}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const key = keyFn(item);
      (acc[key] ??= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function toCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const needsQuotes = /[",\n]/.test(cell);
          const escaped = cell.replace(/"/g, '""');
          return needsQuotes ? `"${escaped}"` : escaped;
        })
        .join(','),
    )
    .join('\n');
}

export function ageFromDob(dob: Date, reference = new Date()): number {
  let age = reference.getFullYear() - dob.getFullYear();
  const m = reference.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && reference.getDate() < dob.getDate())) age--;
  return age;
}

/** One-time staff session handoff between Admin and Judge (cross-origin / cross-port). */
export interface StaffSessionHandoff {
  accessToken: string;
  refreshToken?: string;
  organizationId?: string | null;
  /** Target app the user intentionally opened (skips preferred-app bounce). */
  intent?: 'admin' | 'judge';
}

export const STAFF_SESSION_HANDOFF_PREFIX = 'aj_staff_handoff=';

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + '='.repeat(padLength));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeStaffSessionHandoff(payload: StaffSessionHandoff): string {
  return `${STAFF_SESSION_HANDOFF_PREFIX}${toBase64Url(JSON.stringify(payload))}`;
}

export function parseStaffSessionHandoff(hash: string): StaffSessionHandoff | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw.startsWith(STAFF_SESSION_HANDOFF_PREFIX)) return null;
  try {
    const encoded = raw.slice(STAFF_SESSION_HANDOFF_PREFIX.length);
    const parsed = JSON.parse(fromBase64Url(encoded)) as StaffSessionHandoff;
    if (!parsed?.accessToken || typeof parsed.accessToken !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}
