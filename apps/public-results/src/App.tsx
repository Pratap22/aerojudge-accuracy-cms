import { Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { PilotsPage } from './pages/PilotsPage';
import { PilotProfilePage } from './pages/PilotProfilePage';
import { WomenPage, TeamsPage, CountriesPage } from './pages/CategoryPages';
import { StatisticsPage } from './pages/StatisticsPage';

const DEFAULT_SLUG = (import.meta.env.VITE_DEFAULT_SLUG || '').trim();

function RootRedirect() {
  if (DEFAULT_SLUG) {
    return <Navigate to={`/${DEFAULT_SLUG}`} replace />;
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 p-8 text-center text-slate-100">
      <h1 className="text-2xl font-semibold">AeroJudge Results</h1>
      <p className="max-w-md text-slate-400">
        Open a competition by its public slug, e.g.{' '}
        <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sky-300">/your-competition-slug</code>
      </p>
      <p className="text-sm text-slate-500">
        Or set <code className="text-slate-300">VITE_DEFAULT_SLUG</code> for local development.
      </p>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
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
