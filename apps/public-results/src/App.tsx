import { Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { PilotsPage } from './pages/PilotsPage';
import { PilotProfilePage } from './pages/PilotProfilePage';
import { WomenPage, TeamsPage, CountriesPage } from './pages/CategoryPages';
import { StatisticsPage } from './pages/StatisticsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/npha-acc-2024" replace />} />
      <Route path="/:slug" element={<HomePage />} />
      <Route path="/:slug/results" element={<LeaderboardPage />} />
      <Route path="/:slug/pilots" element={<PilotsPage />} />
      <Route path="/:slug/pilots/:pilotNumber" element={<PilotProfilePage />} />
      <Route path="/:slug/women" element={<WomenPage />} />
      <Route path="/:slug/teams" element={<TeamsPage />} />
      <Route path="/:slug/countries" element={<CountriesPage />} />
      <Route path="/:slug/statistics" element={<StatisticsPage />} />
    </Routes>
  );
}

export default App;
