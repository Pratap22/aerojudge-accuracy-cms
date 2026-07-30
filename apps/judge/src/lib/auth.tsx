import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthTokens, AuthUser } from '@npha/shared';
import { api, clearTokens, getAccessToken, setTokens } from './api';
import { disconnectSocket } from './socket';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  competitionId: string | null;
  setCompetitionId: (id: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const COMPETITION_KEY = 'npha_judge_competition';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [competitionId, setCompetitionIdState] = useState<string | null>(() =>
    localStorage.getItem(COMPETITION_KEY),
  );

  const setCompetitionId = useCallback((id: string | null) => {
    setCompetitionIdState(id);
    if (id) localStorage.setItem(COMPETITION_KEY, id);
    else localStorage.removeItem(COMPETITION_KEY);
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    api
      .get<AuthUser>('/auth/me')
      .then(setUser)
      .catch(() => {
        clearTokens();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<{ user: AuthUser; tokens: AuthTokens }>('/auth/login', {
      email,
      password,
    });
    setTokens(result.tokens);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    disconnectSocket();
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      competitionId,
      setCompetitionId,
      login,
      logout,
    }),
    [user, isLoading, competitionId, setCompetitionId, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
