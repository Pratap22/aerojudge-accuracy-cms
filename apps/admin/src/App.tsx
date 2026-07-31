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
import { OrganizationsPage } from './pages/organizations/OrganizationsPage';
import { OrganizationDetailPage } from './pages/organizations/OrganizationDetailPage';

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
        <Route index element={<Navigate to="/competitions" replace />} />
        <Route path="competitions" element={<CompetitionsPage />} />
        <Route path="competitions/:competitionId" element={<DashboardPage />} />
        <Route path="competitions/:competitionId/pilots" element={<PilotsPage />} />
        <Route path="competitions/:competitionId/teams" element={<TeamsPage />} />
        <Route path="competitions/:competitionId/rounds" element={<RoundsPage />} />
        <Route path="competitions/:competitionId/scoring" element={<ScoringPage />} />
        <Route path="competitions/:competitionId/rankings" element={<RankingsPage />} />
        <Route path="competitions/:competitionId/reports" element={<ReportsPage />} />
        <Route path="competitions/:competitionId/statistics" element={<StatisticsPage />} />
        <Route path="competitions/:competitionId/audit" element={<AuditPage />} />
        <Route path="competitions/:competitionId/settings" element={<SettingsPage />} />
        <Route path="organizations" element={<OrganizationsPage />} />
        <Route path="organizations/:organizationId" element={<OrganizationDetailPage />} />
        <Route path="users" element={<UsersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/competitions" replace />} />
    </Routes>
  );
}
