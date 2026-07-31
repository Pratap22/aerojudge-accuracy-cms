import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { CompetitionListPage } from './pages/CompetitionListPage';
import { HomePage } from './pages/HomePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { PilotsPage } from './pages/PilotsPage';
import { PilotProfilePage } from './pages/PilotProfilePage';
import { WomenPage, TeamsPage, CountriesPage } from './pages/CategoryPages';
import { StatisticsPage } from './pages/StatisticsPage';
import { competitionPath } from './lib/api';

const DEFAULT_ID = (import.meta.env.VITE_DEFAULT_SLUG || '').trim();

function RootRedirect() {
  if (DEFAULT_ID) {
    return <Navigate to={competitionPath(DEFAULT_ID)} replace />;
  }
  return <CompetitionListPage />;
}

/** Keep old `/:slug/...` bookmarks working. */
function LegacySlugRedirect({ suffix = '' }: { suffix?: string }) {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <Navigate to="/" replace />;
  const target = suffix ? competitionPath(slug, suffix) : competitionPath(slug);
  return <Navigate to={target} replace />;
}

function LegacyPilotRedirect() {
  const { slug, pilotNumber } = useParams<{ slug: string; pilotNumber: string }>();
  if (!slug || !pilotNumber) return <Navigate to="/" replace />;
  return <Navigate to={competitionPath(slug, 'pilots', pilotNumber)} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/competition/:competitionId" element={<HomePage />} />
      <Route path="/competition/:competitionId/results" element={<LeaderboardPage />} />
      <Route path="/competition/:competitionId/pilots" element={<PilotsPage />} />
      <Route path="/competition/:competitionId/pilots/:pilotNumber" element={<PilotProfilePage />} />
      <Route path="/competition/:competitionId/women" element={<WomenPage />} />
      <Route path="/competition/:competitionId/teams" element={<TeamsPage />} />
      <Route path="/competition/:competitionId/countries" element={<CountriesPage />} />
      <Route path="/competition/:competitionId/statistics" element={<StatisticsPage />} />

      <Route path="/:slug" element={<LegacySlugRedirect />} />
      <Route path="/:slug/results" element={<LegacySlugRedirect suffix="results" />} />
      <Route path="/:slug/pilots" element={<LegacySlugRedirect suffix="pilots" />} />
      <Route path="/:slug/pilots/:pilotNumber" element={<LegacyPilotRedirect />} />
      <Route path="/:slug/women" element={<LegacySlugRedirect suffix="women" />} />
      <Route path="/:slug/teams" element={<LegacySlugRedirect suffix="teams" />} />
      <Route path="/:slug/countries" element={<LegacySlugRedirect suffix="countries" />} />
      <Route path="/:slug/statistics" element={<LegacySlugRedirect suffix="statistics" />} />
    </Routes>
  );
}

export default App;
