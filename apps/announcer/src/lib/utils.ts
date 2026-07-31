import { formatScoreCm } from '@npha/utils';

export const formatScore = formatScoreCm;

export function pilotFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

export function countryCodeToEmoji(code2: string): string {
  const upper = code2.toUpperCase();
  if (upper.length !== 2) return '';
  return String.fromCodePoint(...upper.split('').map((char) => 127397 + char.charCodeAt(0)));
}

export function windDirectionLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}
