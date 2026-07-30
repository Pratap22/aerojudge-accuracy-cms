import type { OverlayWidget } from './types';

export function formatScore(scoreCm: number | null): string {
  if (scoreCm == null) return '—';
  if (scoreCm === 0) return '0';
  if (Number.isInteger(scoreCm)) return scoreCm.toString();
  return scoreCm.toFixed(1);
}

export function countryCodeToEmoji(code2: string): string {
  const upper = code2.toUpperCase();
  if (upper.length !== 2) return '';
  return String.fromCodePoint(...upper.split('').map((char) => 127397 + char.charCodeAt(0)));
}

export function getEnabledWidgets(): Set<OverlayWidget> {
  const params = new URLSearchParams(window.location.search);
  const widgetsParam = params.get('widgets');

  if (!widgetsParam) {
    return new Set<OverlayWidget>(['lowerthird', 'scorebug', 'wind', 'sponsors', 'countdown']);
  }

  const valid: OverlayWidget[] = ['lowerthird', 'scorebug', 'wind', 'sponsors', 'countdown'];
  const requested = widgetsParam.split(',').map((w) => w.trim().toLowerCase()) as OverlayWidget[];
  return new Set(requested.filter((w) => valid.includes(w)));
}

export function getCountdownTarget(): Date | null {
  const params = new URLSearchParams(window.location.search);
  const target = params.get('countdown');
  if (!target) return null;
  const date = new Date(target);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function windDirectionLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}
