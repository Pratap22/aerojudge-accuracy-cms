import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LegacyJudgeRedirect } from './components/LegacyJudgeRedirect';
import { OrganizationEntry } from './components/OrganizationEntry';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { RoundSelectPage } from './pages/RoundSelectPage';
import { ScoringPage } from './pages/ScoringPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/organizations/:organizationId/competitions/:competitionId/rounds"
        element={
          <ProtectedRoute>
            <RoundSelectPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/organizations/:organizationId/competitions/:competitionId/score/:roundId"
        element={
          <ProtectedRoute>
            <ScoringPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/organizations/:organizationId"
        element={
          <ProtectedRoute>
            <OrganizationEntry />
          </ProtectedRoute>
        }
      />
      <Route path="/rounds" element={<LegacyJudgeRedirect />} />
      <Route path="/score/:roundId" element={<LegacyJudgeRedirect />} />
      <Route path="*" element={<LegacyJudgeRedirect />} />
    </Routes>
  );
}
