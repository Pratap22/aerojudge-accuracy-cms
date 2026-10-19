import { useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LiveLeaderboard } from '../components/LiveLeaderboard';
import { toLeaderboardEntries, useCompetition, useResults } from '../hooks/useCompetition';
import { competitionPath } from '../lib/api';
import { isCompetitionCompleted } from '../lib/competitionStatus';
import { CountriesBoard, TeamsBoard, WomenBoard } from './CategoryPages';
import { ResultsStats } from './StatisticsPage';

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
      <div className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="font-display text-4xl font-bold text-white">{title}</h1>
        <div className="mt-6 flex flex-wrap gap-2">
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
                    ? 'rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-[#050d1a]'
                    : 'rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-sky-100/80 transition-colors hover:bg-white/10 hover:text-white'
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-8">
          {board === 'overall' ? <LiveLeaderboard showHeading={false} showSearch /> : null}
          {board === 'women' ? <WomenBoard embedded /> : null}
          {board === 'teams' ? <TeamsBoard embedded /> : null}
          {board === 'countries' ? <CountriesBoard embedded /> : null}
        </div>

        {board === 'overall' ? <ResultsStats /> : null}
      </div>
    </Layout>
  );
}
