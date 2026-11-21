import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Input } from '@aero-judge/ui';
import { padPilotNumber } from '@aero-judge/utils';
import { Layout } from '../components/Layout';
import {
  competitionPath,
  fetchTeams,
  pilotProfilePath,
  type PublicTeamMember,
  type PublicTeamRoster,
} from '../lib/api';
import { useSlug } from '../hooks/useCompetition';
import { countryCodeToEmoji, pilotFullName } from '../lib/utils';

const ROLE_ORDER = ['CAPTAIN', 'VICE_CAPTAIN', 'PILOT', 'RESERVE'] as const;

function roleLabel(role: string): string | null {
  if (role === 'CAPTAIN') return 'Captain';
  if (role === 'VICE_CAPTAIN') return 'Vice captain';
  if (role === 'RESERVE') return 'Reserve';
  return null;
}

function sortMembers(members: PublicTeamMember[]): PublicTeamMember[] {
  return [...members].sort((a, b) => {
    const roleDelta =
      ROLE_ORDER.indexOf(a.role as (typeof ROLE_ORDER)[number]) -
      ROLE_ORDER.indexOf(b.role as (typeof ROLE_ORDER)[number]);
    if (roleDelta !== 0) return roleDelta;
    return pilotFullName(a.firstName, a.lastName).localeCompare(
      pilotFullName(b.firstName, b.lastName),
    );
  });
}

function teamMatches(team: PublicTeamRoster, query: string): boolean {
  if (!query) return true;
  const haystack = [
    team.name,
    team.country?.name,
    team.country?.code,
    ...team.members.flatMap((member) => [
      pilotFullName(member.firstName, member.lastName),
      member.country?.code,
      member.pilotNumber != null ? String(member.pilotNumber) : '',
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

export function TeamsPage() {
  const competitionId = useSlug();
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-teams', competitionId],
    queryFn: () => fetchTeams(competitionId),
    enabled: Boolean(competitionId),
  });

  const teams = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.teams ?? []).filter((team) => teamMatches(team, query));
  }, [data?.teams, search]);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">Teams</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.teams.length} teams` : 'Competition teams'}
          </p>
          <div className="relative ml-auto w-full max-w-xs sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search teams or pilots…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-8 border-border bg-card pl-8 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {isLoading ? <p className="mt-4 text-muted-foreground">Loading teams…</p> : null}
        {error ? (
          <p className="mt-4 text-red-400">
            {error instanceof Error ? error.message : 'Could not load teams'}
          </p>
        ) : null}
        {!isLoading && !error && teams.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
            <p className="text-lg text-muted-foreground">
              {data?.teams.length ? 'No teams match that search.' : 'No teams yet'}
            </p>
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {teams.map((team) => {
            const members = sortMembers(team.members);
            const flag = countryCodeToEmoji(team.country?.code2 ?? '');
            return (
              <article
                key={team.id}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                {team.logoUrl ? (
                  <img
                    src={team.logoUrl}
                    alt=""
                    className="aspect-[2/1] w-full object-cover"
                  />
                ) : null}
                <div className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {team.logoUrl ? null : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted font-display text-lg font-bold text-muted-foreground">
                          {team.name.slice(0, 1)}
                        </span>
                      )}
                      <h2 className="font-display text-xl font-bold text-foreground">{team.name}</h2>
                    </div>
                    {team.country?.code ? (
                      <p className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                        {flag ? (
                          <span className="text-base leading-none" aria-hidden>
                            {flag}
                          </span>
                        ) : null}
                        <span className="font-medium uppercase tracking-wide">{team.country.code}</span>
                      </p>
                    ) : null}
                  </div>
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No members listed yet.</p>
                  ) : (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {members.map((member) => {
                        const profile = pilotProfilePath(competitionId, member);
                        const label = roleLabel(member.role);
                        const body = (
                          <>
                            {member.photoUrl ? (
                              <img
                                src={member.photoUrl}
                                alt=""
                                className="h-12 w-12 shrink-0 rounded-full object-cover object-top ring-1 ring-border"
                              />
                            ) : (
                              <span
                                className="h-12 w-12 shrink-0 rounded-full bg-muted"
                                aria-hidden
                              />
                            )}
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-foreground">
                                {pilotFullName(member.firstName, member.lastName)}
                              </span>
                              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold tabular-nums text-primary-foreground">
                                  {member.pilotNumber != null
                                    ? padPilotNumber(member.pilotNumber)
                                    : '—'}
                                </span>
                                {label ? <span>{label}</span> : null}
                              </span>
                            </span>
                          </>
                        );
                        return (
                          <li key={member.pilotId}>
                            {profile ? (
                              <Link
                                to={profile}
                                className="flex items-center gap-3 rounded-xl px-1 py-1 transition-colors hover:bg-muted"
                              >
                                {body}
                              </Link>
                            ) : (
                              <div className="flex items-center gap-3 px-1 py-1">{body}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
