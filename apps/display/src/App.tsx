import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { CompetitionListPage } from './pages/CompetitionListPage';
import { DisplayBoardPage } from './pages/DisplayBoardPage';
import { competitionPath } from './lib/api';

/** Redirect legacy `?competition=` links to `/competition/:id`. */
function LegacyCompetitionRedirect() {
  const [params] = useSearchParams();
  const legacy = (params.get('competition') ?? import.meta.env.VITE_COMPETITION_SLUG ?? '').trim();
  if (legacy) {
    return <Navigate to={competitionPath(legacy)} replace />;
  }
  return <CompetitionListPage />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LegacyCompetitionRedirect />} />
      <Route path="/competition/:competitionId" element={<DisplayBoardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
