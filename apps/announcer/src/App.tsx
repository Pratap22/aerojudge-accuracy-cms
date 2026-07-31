import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { CompetitionListPage } from './pages/CompetitionListPage';
import { AnnouncerConsolePage } from './pages/AnnouncerConsolePage';
import { competitionPath } from './lib/api';

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
      <Route path="/competition/:competitionId" element={<AnnouncerConsolePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
