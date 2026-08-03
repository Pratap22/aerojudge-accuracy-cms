import type { ApiResponse, AuthTokens, AuthUser, LoginResult } from '@npha/shared';
import { API_VERSION } from '@npha/shared';

const ACCESS_TOKEN_KEY = 'npha_access_token';
const REFRESH_TOKEN_KEY = 'npha_refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: AuthTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  const response = await fetch(`/api/${API_VERSION}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    clearTokens();
    return null;
  }
  const json = (await response.json()) as ApiResponse<{
    tokens?: AuthTokens;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  }>;
  if (json.success && json.data) {
    const tokens: AuthTokens = json.data.tokens ?? {
      accessToken: json.data.accessToken!,
      refreshToken: json.data.refreshToken ?? refreshToken,
      expiresIn: json.data.expiresIn ?? 3600,
    };
    setTokens(tokens);
    return tokens.accessToken;
  }
  clearTokens();
  return null;
}

export async function authFetch<T>(
  path: string,
  init?: RequestInit & { skipAuth?: boolean },
): Promise<T> {
  const url = `/api/${API_VERSION}${path}`;
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (!init?.skipAuth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(url, { ...init, headers });
  if (response.status === 401 && !init?.skipAuth) {
    const next = await refreshAccessToken();
    if (next) {
      headers.set('Authorization', `Bearer ${next}`);
      response = await fetch(url, { ...init, headers });
    }
  }

  const json = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !json.success || json.data === undefined) {
    throw new Error(json.error?.message ?? `Request failed (${response.status})`);
  }
  return json.data;
}

export function login(email: string, password: string): Promise<LoginResult> {
  return authFetch<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
}

export function registerParticipant(body: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<LoginResult> {
  return authFetch<LoginResult>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export function fetchMe(): Promise<AuthUser> {
  return authFetch<AuthUser>('/auth/me');
}

export function logoutLocal(): void {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    void authFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  clearTokens();
}

export type ClaimLookupResult = {
  matches: Array<{
    confidence: string;
    reason: string;
    claimableByEmail?: boolean;
    person: {
      id: string;
      aeroJudgeId: string;
      firstName: string;
      lastName: string;
      civlId?: string | null;
      nationalityCountry?: { name: string; code: string } | null;
    };
  }>;
  claimableByEmail: boolean;
};

export function lookupPersonForClaim(params: {
  aeroJudgeId?: string;
  civlId?: string;
}): Promise<ClaimLookupResult> {
  const q = new URLSearchParams();
  if (params.aeroJudgeId) q.set('aeroJudgeId', params.aeroJudgeId);
  if (params.civlId) q.set('civlId', params.civlId);
  return authFetch<ClaimLookupResult>(`/auth/me/person/lookup?${q.toString()}`);
}

export function claimPerson(body: {
  personId?: string;
  aeroJudgeId?: string;
  civlId?: string;
}): Promise<{
  status: 'CLAIMED' | 'PENDING_APPROVAL' | 'ALREADY_LINKED';
  person: { id: string; aeroJudgeId: string; firstName: string; lastName: string };
  message?: string;
}> {
  return authFetch('/auth/me/person/claim', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
