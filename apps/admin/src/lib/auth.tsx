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
          // Keep this tab's org; refresh user context for that membership
          const membership = activeMemberships.find((o) => o.organizationId === storedOrg)!;
          setActiveOrganizationId(storedOrg);
          setUser({
            ...me,
            organizationId: membership.organizationId,
            orgRole: membership.role,
            permissions: membership.permissions,
          });
          setRequiresOrganizationSelection(false);
        } else if (me.organizationId) {
          setOrganizationId(me.organizationId);
          setActiveOrganizationId(me.organizationId);
          setRequiresOrganizationSelection(false);
        } else if (activeMemberships.length > 1) {
          setActiveOrganizationId(null);
          setRequiresOrganizationSelection(true);
        } else if (activeMemberships.length === 1) {
          const only = activeMemberships[0].organizationId;
          setOrganizationId(only);
          setActiveOrganizationId(only);
          setRequiresOrganizationSelection(false);
        }
      })
      .catch(() => {
        clearTokens();
        setUser(null);
        setOrganizations([]);
        setActiveOrganizationId(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<LoginResult>('/auth/login', { email, password });
    setTokens(result.tokens);
    setUser(result.user);
    setOrganizations(result.organizations);
    setRequiresOrganizationSelection(result.requiresOrganizationSelection);
    if (result.user.organizationId) {
      setOrganizationId(result.user.organizationId);
      setActiveOrganizationId(result.user.organizationId);
    } else {
      setOrganizationId(null);
      setActiveOrganizationId(null);
    }
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
    setOrganizationId(organizationId);
    setActiveOrganizationId(organizationId);
    setUser(result.user);
    setOrganizations(result.organizations);
    setRequiresOrganizationSelection(false);
  }, []);

  const logout = useCallback(() => {
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
