import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RoundSelectPage } from './pages/RoundSelectPage';
import { ScoringPage } from './pages/ScoringPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
