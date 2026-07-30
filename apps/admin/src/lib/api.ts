import type { ApiResponse, AuthTokens } from '@npha/shared';
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
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

let refreshPromise: Promise<string | null> | null = null;

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

  const json = (await response.json()) as ApiResponse<AuthTokens>;
  if (json.success && json.data) {
    setTokens(json.data);
    return json.data.accessToken;
  }

  clearTokens();
  return null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const url = path.startsWith('/api') ? path : `/api/${API_VERSION}${path.startsWith('/') ? path : `/${path}`}`;
  if (!params) return url;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, params, headers, ...rest } = options;

  const doFetch = async (token: string | null) => {
    const requestHeaders: Record<string, string> = {
      ...(headers as Record<string, string>),
    };

    if (body !== undefined) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }

    return fetch(buildUrl(path, params), {
      ...rest,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let token = getAccessToken();
  let response = await doFetch(token);

  if (response.status === 401 && getRefreshToken()) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    token = await refreshPromise;
    if (token) {
      response = await doFetch(token);
    }
  }

  const json = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !json.success) {
    throw new ApiError(
      json.error?.message ?? `Request failed (${response.status})`,
      json.error?.code ?? 'UNKNOWN',
      response.status,
      json.error?.details,
    );
  }

  return json.data as T;
}

export const api = {
  get: <T>(path: string, params?: RequestOptions['params']) =>
    apiRequest<T>(path, { method: 'GET', params }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
