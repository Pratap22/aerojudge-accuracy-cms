import { formatScoreCm } from '@npha/utils';

export function countryCodeToEmoji(code2: string): string {
  const upper = code2.toUpperCase();
  if (upper.length !== 2) return '';
  return String.fromCodePoint(...upper.split('').map((char) => 127397 + char.charCodeAt(0)));
}

export const formatScore = formatScoreCm;

export function pilotFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

export function getLayoutFromQuery(): string {
  return new URLSearchParams(window.location.search).get('layout') ?? 'auto';
}

export function isKioskMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('kiosk') === 'true' || params.get('kiosk') === '1';
}

export function getAutoInterval(): number {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('interval');
  if (fromQuery) return Math.max(5, parseInt(fromQuery, 10) || 15);
  const fromEnv = import.meta.env.VITE_AUTO_INTERVAL;
  if (fromEnv) return Math.max(5, parseInt(fromEnv, 10) || 15);
  return 15;
}
