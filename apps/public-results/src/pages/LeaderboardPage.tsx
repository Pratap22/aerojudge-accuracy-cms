import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@aero-judge/ui';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LiveLeaderboard } from '../components/LiveLeaderboard';
import { toLeaderboardEntries, useCompetition, useResults } from '../hooks/useCompetition';
import { competitionPath } from '../lib/api';
import { isCompetitionCompleted } from '../lib/competitionStatus';
import { CountriesBoard, TeamsBoard, WomenBoard } from './CategoryPages';
import { ResultsStats } from './StatisticsPage';
import { FaiCategoryBadge } from '../components/FaiCategoryBadge';

const BOARDS = ['overall', 'women', 'teams', 'countries'] as const;
type Board = (typeof BOARDS)[number];

function isBoard(value: string | null): value is Board {
  return BOARDS.includes(value as Board);
}

export function LeaderboardPage() {
  const { competitionId = '' } = useParams<{ competitionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const { data: competition } = useCompetition();
  const { data: countryResults, isSuccess: countriesReady } = useResults('COUNTRY');
  const showCountries = countriesReady && toLeaderboardEntries(countryResults).length > 1;
  const requested = params.get('board');
  const board: Board =
    requested === 'countries' && countriesReady && !showCountries
      ? 'overall'
      : isBoard(requested)
        ? requested
        : 'overall';
  const completed = isCompetitionCompleted(competition?.status);
  const hasTeams = (competition?.teamCount ?? 0) > 0;
  const resultsPath = competitionPath(competitionId, 'results');

  const boards: { id: Board; label: string }[] = [
    { id: 'overall', label: 'Overall' },
    { id: 'women', label: 'Women' },
    ...(hasTeams ? [{ id: 'teams' as const, label: 'Teams' }] : []),
    ...(showCountries ? [{ id: 'countries' as const, label: 'Countries' }] : []),
  ];

  useEffect(() => {
    if (location.hash !== '#stats' || board !== 'overall') return;
    document.getElementById('stats')?.scrollIntoView();
  }, [location.hash, board]);

  useEffect(() => {
    if (!countriesReady || showCountries || requested !== 'countries') return;
    navigate(resultsPath, { replace: true });
  }, [countriesReady, showCountries, requested, navigate, resultsPath]);

  const title =
    board === 'women'
      ? "Women's ranking"
      : board === 'teams'
        ? 'Team ranking'
        : board === 'countries'
          ? 'Country ranking'
          : !competition
            ? 'Results'
            : completed
              ? 'Final results'
              : 'Live results';

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
          <FaiCategoryBadge value={competition?.faiCategory} />
          <div className="flex flex-wrap gap-1.5">
            {boards.map((item) => {
              const active = item.id === board;
              const to = item.id === 'overall' ? resultsPath : `${resultsPath}?board=${item.id}`;
              return (
                <Link
                  key={item.id}
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-[#050d1a]'
                      : 'rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          {board === 'overall' ? (
            <div className="relative ml-auto w-full max-w-[14rem] sm:w-52">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search pilots…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-8 border-border bg-card pl-8 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-3">
          {board === 'overall' ? (
            <LiveLeaderboard showHeading={false} showSearch={false} query={query} />
          ) : null}
          {board === 'women' ? <WomenBoard embedded /> : null}
          {board === 'teams' ? <TeamsBoard embedded /> : null}
          {board === 'countries' ? <CountriesBoard embedded /> : null}
        </div>

        {board === 'overall' ? <ResultsStats /> : null}
      </div>
    </Layout>
  );
}
