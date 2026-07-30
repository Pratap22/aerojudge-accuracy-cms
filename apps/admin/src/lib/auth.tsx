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
import { connectSocket, disconnectSocket } from './socket';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  activeCompetitionId: string | null;
  setActiveCompetitionId: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const COMPETITION_KEY = 'npha_active_competition';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCompetitionId, setActiveCompetitionIdState] = useState<string | null>(() =>
    localStorage.getItem(COMPETITION_KEY),
  );

  const setActiveCompetitionId = useCallback((id: string | null) => {
    setActiveCompetitionIdState(id);
    if (id) {
      localStorage.setItem(COMPETITION_KEY, id);
      connectSocket(id);
    } else {
      localStorage.removeItem(COMPETITION_KEY);
    }
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    api
      .get<AuthUser>('/auth/me')
      .then((me) => {
        setUser(me);
        if (activeCompetitionId) {
          connectSocket(activeCompetitionId);
        }
      })
      .catch(() => {
        clearTokens();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, [activeCompetitionId]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<{ user: AuthUser; tokens: AuthTokens }>('/auth/login', {
      email,
      password,
    });
    setTokens(result.tokens);
    setUser(result.user);
    if (activeCompetitionId) {
      connectSocket(activeCompetitionId);
    }
  }, [activeCompetitionId]);

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
      login,
      logout,
      activeCompetitionId,
      setActiveCompetitionId,
    }),
    [user, isLoading, login, logout, activeCompetitionId, setActiveCompetitionId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
