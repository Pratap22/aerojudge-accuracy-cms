import { Redirect } from 'expo-router';
import { hrefForCompetitionTarget } from '../lib/links';
import { firstParam } from '../lib/results';

export function CompetitionRedirect({
  id,
  layout,
  results,
}: {
  id: string | string[] | undefined;
  layout?: string | string[] | undefined;
  results: boolean;
}) {
  const competitionId = firstParam(id);
  if (!competitionId) return <Redirect href="/" />;
  return (
    <Redirect
      href={hrefForCompetitionTarget({
        competitionId,
        layout: firstParam(layout),
        results,
      })}
    />
  );
}
