import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RequirePermission } from './components/RequirePermission';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CompetitionsPage } from './pages/CompetitionsPage';
import { PilotsPage } from './pages/PilotsPage';
import { TeamsPage } from './pages/TeamsPage';
import { SponsorsPage } from './pages/SponsorsPage';
import { RoundsPage } from './pages/RoundsPage';
import { ScoringPage } from './pages/ScoringPage';
import { RankingsPage } from './pages/RankingsPage';
import { UsersPage } from './pages/UsersPage';
import { ReportsPage } from './pages/ReportsPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';
import { OrganizationsPage } from './pages/organizations/OrganizationsPage';
import { ArchivedOrganizationsPage } from './pages/organizations/ArchivedOrganizationsPage';
import { OrganizationDetailPage } from './pages/organizations/OrganizationDetailPage';
import { OrganizationMembersPage } from './pages/organizations/OrganizationMembersPage';

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
        <Route
          path="competitions/:competitionId"
          element={
            <RequirePermission anyOf={['competition:update', 'competition:publish', 'round:manage']}>
              <DashboardPage />
            </RequirePermission>
          }
        />
        <Route
          path="competitions/:competitionId/pilots"
          element={
            <RequirePermission anyOf={['pilot:manage']}>
              <PilotsPage />
            </RequirePermission>
          }
        />
        <Route
          path="competitions/:competitionId/teams"
          element={
            <RequirePermission anyOf={['team:manage']}>
              <TeamsPage />
            </RequirePermission>
          }
        />
        <Route
          path="competitions/:competitionId/sponsors"
          element={
            <RequirePermission anyOf={['competition:update']}>
              <SponsorsPage />
            </RequirePermission>
          }
        />
        <Route
          path="competitions/:competitionId/rounds"
          element={
            <RequirePermission anyOf={['round:manage', 'round:start', 'round:close']}>
              <RoundsPage />
            </RequirePermission>
          }
        />
        <Route
          path="competitions/:competitionId/scoring"
          element={
            <RequirePermission anyOf={['score:enter', 'score:confirm']}>
              <ScoringPage />
            </RequirePermission>
          }
        />
        <Route
          path="competitions/:competitionId/rankings"
          element={
            <RequirePermission
              anyOf={['results:publish', 'score:confirm', 'round:manage', 'print:generate']}
            >
              <RankingsPage />
            </RequirePermission>
          }
        />
        <Route
          path="competitions/:competitionId/reports"
          element={
            <RequirePermission anyOf={['print:generate']}>
              <ReportsPage />
            </RequirePermission>
          }
        />
        <Route
          path="competitions/:competitionId/statistics"
          element={
            <RequirePermission
              anyOf={['results:publish', 'score:confirm', 'audit:view', 'print:generate']}
            >
              <StatisticsPage />
            </RequirePermission>
          }
        />
        <Route
          path="competitions/:competitionId/audit"
          element={
            <RequirePermission anyOf={['audit:view']}>
              <AuditPage />
            </RequirePermission>
          }
        />
        <Route
          path="competitions/:competitionId/settings"
          element={
            <RequirePermission anyOf={['competition:update']}>
              <SettingsPage />
            </RequirePermission>
          }
        />
        <Route
          path="organizations"
          element={
            <RequirePermission
              anyOf={[
                'organization:read',
                'organization:manage',
                'organization:members',
                'platform:organizations',
              ]}
            >
              <OrganizationsPage />
            </RequirePermission>
          }
        />
        <Route
          path="organizations/archived"
          element={
            <RequirePermission anyOf={['platform:organizations']}>
              <ArchivedOrganizationsPage />
            </RequirePermission>
          }
        />
        <Route
          path="organizations/:organizationId"
          element={
            <RequirePermission
              anyOf={[
                'organization:read',
                'organization:manage',
                'organization:members',
                'platform:organizations',
              ]}
            >
              <OrganizationDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="organizations/:organizationId/members"
          element={
            <RequirePermission
              anyOf={['organization:members', 'organization:manage', 'platform:organizations']}
            >
              <OrganizationMembersPage />
            </RequirePermission>
          }
        />
        <Route path="users" element={<UsersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/competitions" replace />} />
    </Routes>
  );
}
