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

export function formatScoreCm(cm: number | null | undefined, maximum = 1000): string {
  if (cm === null || cm === undefined) return '—';
  if (cm >= maximum) return String(maximum);
  if (cm === 0) return '0';
  return cm % 1 === 0 ? String(cm) : cm.toFixed(1);
}

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
