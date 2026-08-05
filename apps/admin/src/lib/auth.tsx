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
  /** Session/org header used for API calls — updates immediately on switch. */
  activeOrganizationId: string | null;
  requiresOrganizationSelection: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  selectOrganization: (organizationId: string) => Promise<void>;
  /** Re-fetch /auth/me so sidebar memberships stay in sync (e.g. after creating an org). */
  refreshMemberships: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organizations, setOrganizations] = useState<AuthOrganizationMembership[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(
    () => getOrganizationId(),
  );
  const [requiresOrganizationSelection, setRequiresOrganizationSelection] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const applyMeContext = useCallback((me: AuthUser) => {
    const memberships = me.organizations ?? [];
    setOrganizations(memberships);
    const storedOrg = getOrganizationId();
    const activeMemberships = memberships.filter((o) => o.status === 'ACTIVE');

    if (storedOrg && activeMemberships.some((o) => o.organizationId === storedOrg)) {
      // Keep this tab's org; refresh user context for that membership
      const membership = activeMemberships.find((o) => o.organizationId === storedOrg)!;
      // Ensure API header matches React state (avoids empty competition lists)
      setOrganizationId(storedOrg);
      setActiveOrganizationId(storedOrg);
      setUser({
        ...me,
        organizationId: membership.organizationId,
        orgRole: membership.role,
        permissions: membership.permissions,
      });
      setRequiresOrganizationSelection(false);
      return;
    }

    if (me.organizationId) {
      setOrganizationId(me.organizationId);
      setActiveOrganizationId(me.organizationId);
      setUser(me);
      setRequiresOrganizationSelection(false);
      return;
    }

    if (activeMemberships.length > 1) {
      setOrganizationId(null);
      setActiveOrganizationId(null);
      setUser(me);
      setRequiresOrganizationSelection(true);
      return;
    }

    if (activeMemberships.length === 1) {
      const only = activeMemberships[0].organizationId;
      setOrganizationId(only);
      setActiveOrganizationId(only);
      setUser({
        ...me,
        organizationId: only,
        orgRole: activeMemberships[0].role,
        permissions: activeMemberships[0].permissions,
      });
      setRequiresOrganizationSelection(false);
      return;
    }

    setUser(me);
    setOrganizationId(null);
    setActiveOrganizationId(null);
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
        applyMeContext(me);
      })
      .catch(() => {
        clearTokens();
        setUser(null);
        setOrganizations([]);
        setActiveOrganizationId(null);
      })
      .finally(() => setIsLoading(false));
  }, [applyMeContext]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<LoginResult>('/auth/login', { email, password });
    setTokens(result.tokens);
    setOrganizations(result.organizations);
    setRequiresOrganizationSelection(result.requiresOrganizationSelection);
    // Write org header before React re-renders so the first competitions fetch is scoped
    if (result.user.organizationId) {
      setOrganizationId(result.user.organizationId);
      setActiveOrganizationId(result.user.organizationId);
    } else {
      setOrganizationId(null);
      setActiveOrganizationId(null);
    }
    setUser(result.user);
    return result;
  }, []);

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
    // Drop competition real-time sessions tied to the previous org context
    disconnectSocket();
    // Header must be set before state updates trigger React Query refetches
    setOrganizationId(organizationId);
    setActiveOrganizationId(organizationId);
    setUser(result.user);
    setOrganizations(result.organizations);
    setRequiresOrganizationSelection(false);
  }, []);

  const refreshMemberships = useCallback(async () => {
    const me = await api.get<AuthUser>('/auth/me');
    applyMeContext(me);
  }, [applyMeContext]);

  const logout = useCallback(() => {
    const refreshToken = getRefreshToken();
    // Revoke server-side session best-effort; always clear local client state.
    if (refreshToken) {
      void api.post('/auth/logout', { refreshToken }).catch(() => undefined);
    }
    clearTokens();
    setOrganizationId(null);
    setActiveOrganizationId(null);
    setUser(null);
    setOrganizations([]);
    setRequiresOrganizationSelection(false);
    disconnectSocket();
  }, []);

  const currentOrganization = useMemo(() => {
    const orgId = activeOrganizationId || user?.organizationId;
    if (!orgId) return null;
    return organizations.find((o) => o.organizationId === orgId) ?? null;
  }, [activeOrganizationId, user, organizations]);

  const value = useMemo(
    () => ({
      user,
      organizations,
      currentOrganization,
      activeOrganizationId,
      requiresOrganizationSelection,
      isLoading,
      isAuthenticated: !!user,
      login,
      selectOrganization,
      refreshMemberships,
      logout,
    }),
    [
      user,
      organizations,
      currentOrganization,
      activeOrganizationId,
      requiresOrganizationSelection,
      isLoading,
      login,
      selectOrganization,
      refreshMemberships,
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
