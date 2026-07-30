import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CompetitionsPage } from './pages/CompetitionsPage';
import { PilotsPage } from './pages/PilotsPage';
import { TeamsPage } from './pages/TeamsPage';
import { RoundsPage } from './pages/RoundsPage';
import { ScoringPage } from './pages/ScoringPage';
import { RankingsPage } from './pages/RankingsPage';
import { UsersPage } from './pages/UsersPage';
import { ReportsPage } from './pages/ReportsPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="competitions" element={<CompetitionsPage />} />
        <Route path="pilots" element={<PilotsPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="rounds" element={<RoundsPage />} />
        <Route path="scoring" element={<ScoringPage />} />
        <Route path="rankings" element={<RankingsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="statistics" element={<StatisticsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
