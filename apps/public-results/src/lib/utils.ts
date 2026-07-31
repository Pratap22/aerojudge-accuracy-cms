import { formatScoreCm } from '@npha/utils';

export function countryCodeToEmoji(code2: string): string {
  const upper = code2.trim().toUpperCase();
  if (upper.length !== 2 || upper === 'XX' || !/^[A-Z]{2}$/.test(upper)) return '';
  return String.fromCodePoint(...upper.split('').map((char) => 127397 + char.charCodeAt(0)));
}

export const formatScore = formatScoreCm;

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function pilotFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}
