import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
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
        path="/rounds"
        element={
          <ProtectedRoute>
            <RoundSelectPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/score/:roundId"
        element={
          <ProtectedRoute>
            <ScoringPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/rounds" replace />} />
    </Routes>
  );
}
