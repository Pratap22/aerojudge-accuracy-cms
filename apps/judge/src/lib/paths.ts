export function roundsPath(organizationId: string, competitionId: string): string {
  return `/organizations/${organizationId}/competitions/${competitionId}/rounds`;
}

export function scorePath(
  organizationId: string,
  competitionId: string,
  roundId: string,
): string {
  return `/organizations/${organizationId}/competitions/${competitionId}/score/${roundId}`;
}

export function parseJudgeLocation(pathname: string): {
  organizationId?: string;
  competitionId?: string;
  roundId?: string;
} {
  const match = pathname.match(
    /^\/organizations\/([^/]+)\/competitions\/([^/]+)(?:\/(?:rounds|score\/([^/]+)))?/,
  );
  if (!match) return {};
  return {
    organizationId: match[1],
    competitionId: match[2],
    roundId: match[3],
  };
}
