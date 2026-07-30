export function countryCodeToEmoji(code2: string): string {
  const upper = code2.toUpperCase();
  if (upper.length !== 2) return '';
  return String.fromCodePoint(...upper.split('').map((char) => 127397 + char.charCodeAt(0)));
}

export function formatScore(scoreCm: number | null): string {
  if (scoreCm == null) return '—';
  if (scoreCm === 0) return '0';
  if (Number.isInteger(scoreCm)) return scoreCm.toString();
  return scoreCm.toFixed(1);
}

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
