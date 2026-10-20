/** Full-screen venue board. Dev uses the display port; production uses the /display prefix. */
export function venueDisplayUrl(competitionId: string): string {
  const path = `/competition/${encodeURIComponent(competitionId)}`;
  if (import.meta.env.DEV) {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:3002${path}`;
  }
  return `${window.location.origin}/display${path}`;
}
