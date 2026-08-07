import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RequirePermission } from './components/RequirePermission';
import {
  ActiveOrgCompetitionsRedirect,
  LegacyCompetitionRedirect,
} from './components/OrgRouteRedirects';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { CompetitionsPage } from './pages/CompetitionsPage';
import { ArchivedCompetitionsPage } from './pages/ArchivedCompetitionsPage';
import { PilotsPage } from './pages/PilotsPage';
import { TeamsPage } from './pages/TeamsPage';
import { SponsorsPage } from './pages/SponsorsPage';
import { EventInfoPage } from './pages/EventInfoPage';
import { OfficialsPage } from './pages/OfficialsPage';
import { RoundsPage } from './pages/RoundsPage';
import { ScoringPage } from './pages/ScoringPage';
import { RankingsPage } from './pages/RankingsPage';
import { UsersPage } from './pages/UsersPage';
import { ProfileClaimsPage } from './pages/ProfileClaimsPage';
import { ReportsPage } from './pages/ReportsPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';
import { OrganizationsPage } from './pages/organizations/OrganizationsPage';
import { ArchivedOrganizationsPage } from './pages/organizations/ArchivedOrganizationsPage';
import { OrganizationDetailPage } from './pages/organizations/OrganizationDetailPage';
import { OrganizationMembersPage } from './pages/organizations/OrganizationMembersPage';

function CompetitionRoutes() {
  return (
    <>
      <Route path=":organizationId/competitions" element={<CompetitionsPage />} />
      <Route
        path=":organizationId/competitions/archived"
        element={
          <RequirePermission anyOf={['competition:update']}>
            <ArchivedCompetitionsPage />
          </RequirePermission>
        }
      />
      <Route
        path=":organizationId/competitions/:competitionId"
        element={
          <RequirePermission anyOf={['competition:update', 'competition:publish', 'round:manage']}>
            <DashboardPage />
          </RequirePermission>
        }
      />
      <Route
        path=":organizationId/competitions/:competitionId/pilots"
        element={
          <RequirePermission anyOf={['pilot:manage']}>
            <PilotsPage />
          </RequirePermission>
        }
      />
      <Route
        path=":organizationId/competitions/:competitionId/teams"
        element={
          <RequirePermission anyOf={['team:manage']}>
            <TeamsPage />
          </RequirePermission>
        }
      />
      <Route
        path=":organizationId/competitions/:competitionId/sponsors"
        element={
          <RequirePermission anyOf={['competition:update']}>
            <SponsorsPage />
          </RequirePermission>
        }
      />
      <Route
        path=":organizationId/competitions/:competitionId/officials"
        element={
          <RequirePermission anyOf={['competition:update']}>
            <OfficialsPage />
          </RequirePermission>
        }
      />
      <Route
        path=":organizationId/competitions/:competitionId/info"
        element={
          <RequirePermission anyOf={['competition:update']}>
            <EventInfoPage />
          </RequirePermission>
        }
      />
      <Route
        path=":organizationId/competitions/:competitionId/rounds"
        element={
          <RequirePermission anyOf={['round:manage', 'round:start', 'round:close']}>
            <RoundsPage />
          </RequirePermission>
        }
      />
      <Route
        path=":organizationId/competitions/:competitionId/scoring"
        element={
          <RequirePermission anyOf={['score:enter', 'score:confirm']}>
            <ScoringPage />
          </RequirePermission>
        }
      />
      <Route
        path=":organizationId/competitions/:competitionId/rankings"
        element={
          <RequirePermission
            anyOf={['results:publish', 'score:confirm', 'round:manage', 'print:generate']}
          >
            <RankingsPage />
          </RequirePermission>
        }
      />
      <Route
        path=":organizationId/competitions/:competitionId/reports"
        element={
          <RequirePermission anyOf={['print:generate']}>
            <ReportsPage />
          </RequirePermission>
        }
      />
      <Route
        path=":organizationId/competitions/:competitionId/statistics"
        element={
          <RequirePermission
            anyOf={['results:publish', 'score:confirm', 'audit:view', 'print:generate']}
          >
            <StatisticsPage />
          </RequirePermission>
        }
      />
      <Route
        path=":organizationId/competitions/:competitionId/audit"
        element={
          <RequirePermission anyOf={['audit:view']}>
            <AuditPage />
          </RequirePermission>
        }
      />
      <Route
        path=":organizationId/competitions/:competitionId/settings"
        element={
          <RequirePermission anyOf={['competition:update']}>
            <SettingsPage />
          </RequirePermission>
        }
      />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ActiveOrgCompetitionsRedirect />} />

        {/* Legacy competition URLs → org-nested */}
        <Route path="competitions" element={<ActiveOrgCompetitionsRedirect />} />
        <Route path="competitions/archived" element={<ActiveOrgCompetitionsRedirect archived />} />
        <Route path="competitions/:competitionId/*" element={<LegacyCompetitionRedirect />} />

        <Route path="organizations">
          <Route
            index
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
            path="archived"
            element={
              <RequirePermission anyOf={['platform:organizations']}>
                <ArchivedOrganizationsPage />
              </RequirePermission>
            }
          />
          <Route
            path=":organizationId"
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
            path=":organizationId/members"
            element={
              <RequirePermission
                anyOf={['organization:members', 'organization:manage', 'platform:organizations']}
              >
                <OrganizationMembersPage />
              </RequirePermission>
            }
          />
          {CompetitionRoutes()}
        </Route>

        <Route path="users" element={<UsersPage />} />
        <Route
          path="profile-claims"
          element={
            <RequirePermission anyOf={['pilot:manage']}>
              <ProfileClaimsPage />
            </RequirePermission>
          }
        />
      </Route>
      <Route path="*" element={<ActiveOrgCompetitionsRedirect />} />
    </Routes>
  );
}
