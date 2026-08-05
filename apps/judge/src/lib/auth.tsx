import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  AuthOrganizationMembership,
  AuthUser,
  LoginResult,
} from '@npha/shared';
import {
  api,
  clearTokens,
  getAccessToken,
  getOrganizationId,
  getRefreshToken,
  setOrganizationId,
  setTokens,
} from './api';
import { disconnectSocket } from './socket';

interface AuthContextValue {
  user: AuthUser | null;
  organizations: AuthOrganizationMembership[];
  currentOrganization: AuthOrganizationMembership | null;
  requiresOrganizationSelection: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  competitionId: string | null;
  setCompetitionId: (id: string | null) => void;
  login: (email: string, password: string) => Promise<LoginResult>;
  selectOrganization: (organizationId: string) => Promise<LoginResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const COMPETITION_KEY = 'npha_judge_competition';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organizations, setOrganizations] = useState<AuthOrganizationMembership[]>([]);
  const [requiresOrganizationSelection, setRequiresOrganizationSelection] = useState(false);
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
      .then((me) => {
        setUser(me);
        setOrganizations(me.organizations ?? []);
        const storedOrg = getOrganizationId();
        const activeMemberships =
          me.organizations?.filter((o) => o.status === 'ACTIVE') ?? [];

        if (storedOrg && activeMemberships.some((o) => o.organizationId === storedOrg)) {
          const membership = activeMemberships.find((o) => o.organizationId === storedOrg)!;
          setUser({
            ...me,
            organizationId: membership.organizationId,
            orgRole: membership.role,
            permissions: membership.permissions,
          });
          setRequiresOrganizationSelection(false);
        } else if (me.organizationId) {
          setOrganizationId(me.organizationId);
          setRequiresOrganizationSelection(false);
        } else if (activeMemberships.length > 1) {
          setRequiresOrganizationSelection(true);
        } else if (activeMemberships.length === 1) {
          setOrganizationId(activeMemberships[0].organizationId);
          setUser({
            ...me,
            organizationId: activeMemberships[0].organizationId,
            orgRole: activeMemberships[0].role,
            permissions: activeMemberships[0].permissions,
          });
          setRequiresOrganizationSelection(false);
        }
      })
      .catch(() => {
        clearTokens();
        setUser(null);
        setOrganizations([]);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<LoginResult>('/auth/login', { email, password });
    setTokens(result.tokens);
    setUser(result.user);
    setOrganizations(result.organizations);
    setRequiresOrganizationSelection(result.requiresOrganizationSelection);
    setCompetitionId(null);
    if (result.user.organizationId) {
      setOrganizationId(result.user.organizationId);
    } else {
      setOrganizationId(null);
    }
    return result;
  }, [setCompetitionId]);

  const selectOrganization = useCallback(async (organizationId: string) => {
    const result = await api.post<LoginResult>('/auth/select-organization', {
      organizationId,
    });
    if (result.tokens.accessToken) {
      const refresh = getRefreshToken();
      setTokens({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken || refresh || '',
        expiresIn: result.tokens.expiresIn,
      });
    }
    setOrganizationId(organizationId);
    setUser(result.user);
    setOrganizations(result.organizations);
    setRequiresOrganizationSelection(false);
    setCompetitionId(null);
    return result;
  }, [setCompetitionId]);

  const logout = useCallback(() => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      void api.post('/auth/logout', { refreshToken }).catch(() => undefined);
    }
    clearTokens();
    setOrganizationId(null);
    setUser(null);
    setOrganizations([]);
    setRequiresOrganizationSelection(false);
    setCompetitionId(null);
    disconnectSocket();
  }, [setCompetitionId]);

  const currentOrganization = useMemo(() => {
    const orgId = getOrganizationId() || user?.organizationId;
    if (!orgId) return null;
    return organizations.find((o) => o.organizationId === orgId) ?? null;
  }, [user, organizations]);

  const value = useMemo(
    () => ({
      user,
      organizations,
      currentOrganization,
      requiresOrganizationSelection,
      isLoading,
      isAuthenticated: !!user,
      competitionId,
      setCompetitionId,
      login,
      selectOrganization,
      logout,
    }),
    [
      user,
      organizations,
      currentOrganization,
      requiresOrganizationSelection,
      isLoading,
      competitionId,
      setCompetitionId,
      login,
      selectOrganization,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
