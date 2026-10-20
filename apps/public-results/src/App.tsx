import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { CompetitionListPage } from './pages/CompetitionListPage';
import { HomePage } from './pages/HomePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { PilotsPage } from './pages/PilotsPage';
import { PilotProfilePage } from './pages/PilotProfilePage';
import { PersonProfilePage } from './pages/PersonProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { EventPage } from './pages/EventPage';
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

function SectionRedirect({
  segment,
  hash,
  search,
}: {
  segment: string;
  hash?: string;
  search?: string;
}) {
  const { competitionId } = useParams<{ competitionId: string }>();
  if (!competitionId) return <Navigate to="/" replace />;
  const path = competitionPath(competitionId, segment);
  const target = `${path}${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`;
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
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/competition/:competitionId" element={<HomePage />} />
      <Route path="/competition/:competitionId/results" element={<LeaderboardPage />} />
      <Route path="/competition/:competitionId/pilots" element={<PilotsPage />} />
      <Route path="/competition/:competitionId/pilots/:pilotNumber" element={<PilotProfilePage />} />
      <Route path="/competition/:competitionId/profile/:aeroJudgeId" element={<PersonProfilePage />} />
      <Route path="/competition/:competitionId/register" element={<RegisterPage />} />
      <Route path="/competition/:competitionId/event" element={<EventPage />} />
      <Route path="/competition/:competitionId/women" element={<SectionRedirect segment="results" search="board=women" />} />
      <Route path="/competition/:competitionId/teams" element={<SectionRedirect segment="results" search="board=teams" />} />
      <Route path="/competition/:competitionId/countries" element={<SectionRedirect segment="results" search="board=countries" />} />
      <Route path="/competition/:competitionId/statistics" element={<SectionRedirect segment="results" hash="stats" />} />
      <Route path="/competition/:competitionId/officials" element={<SectionRedirect segment="event" hash="officials" />} />
      <Route path="/competition/:competitionId/info" element={<SectionRedirect segment="event" hash="info" />} />
      <Route path="/competition/:competitionId/feed" element={<SectionRedirect segment="event" hash="feed" />} />
      <Route path="/competition/:competitionId/news" element={<SectionRedirect segment="event" hash="feed" />} />

      <Route path="/:slug" element={<LegacySlugRedirect />} />
      <Route path="/:slug/results" element={<LegacySlugRedirect suffix="results" />} />
      <Route path="/:slug/pilots" element={<LegacySlugRedirect suffix="pilots" />} />
      <Route path="/:slug/pilots/:pilotNumber" element={<LegacyPilotRedirect />} />
      <Route path="/:slug/register" element={<LegacySlugRedirect suffix="register" />} />
      <Route path="/:slug/women" element={<LegacySlugRedirect suffix="women" />} />
      <Route path="/:slug/teams" element={<LegacySlugRedirect suffix="teams" />} />
      <Route path="/:slug/countries" element={<LegacySlugRedirect suffix="countries" />} />
      <Route path="/:slug/statistics" element={<LegacySlugRedirect suffix="statistics" />} />
      <Route path="/:slug/officials" element={<LegacySlugRedirect suffix="officials" />} />
      <Route path="/:slug/info" element={<LegacySlugRedirect suffix="info" />} />
      <Route path="/:slug/feed" element={<LegacySlugRedirect suffix="feed" />} />
      <Route path="/:slug/news" element={<LegacySlugRedirect suffix="feed" />} />
      <Route path="/:slug/event" element={<LegacySlugRedirect suffix="event" />} />
    </Routes>
  );
}

export default App;
