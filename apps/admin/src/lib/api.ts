import type { ApiResponse, AuthTokens } from '@aero-judge/shared';
import { API_VERSION, ORGANIZATION_HEADER } from '@aero-judge/shared';

const ACCESS_TOKEN_KEY = 'npha_access_token';
const REFRESH_TOKEN_KEY = 'npha_refresh_token';
const ORGANIZATION_ID_KEY = 'npha_organization_id';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Active org is per browser tab (sessionStorage) so one login session can open
 * different organizations in different tabs. Tokens stay in localStorage.
 */
export function getOrganizationId(): string | null {
  const fromSession = sessionStorage.getItem(ORGANIZATION_ID_KEY);
  if (fromSession) return fromSession;
  // One-time migrate from older localStorage-based org context
  const legacy = localStorage.getItem(ORGANIZATION_ID_KEY);
  if (legacy) {
    sessionStorage.setItem(ORGANIZATION_ID_KEY, legacy);
    localStorage.removeItem(ORGANIZATION_ID_KEY);
    return legacy;
  }
  return null;
}

export function setOrganizationId(organizationId: string | null): void {
  localStorage.removeItem(ORGANIZATION_ID_KEY);
  if (organizationId) sessionStorage.setItem(ORGANIZATION_ID_KEY, organizationId);
  else sessionStorage.removeItem(ORGANIZATION_ID_KEY);
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
  localStorage.removeItem(ORGANIZATION_ID_KEY);
  sessionStorage.removeItem(ORGANIZATION_ID_KEY);
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch(`/api/${API_VERSION}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refreshToken,
      organizationId: getOrganizationId() ?? undefined,
    }),
  });

  if (!response.ok) {
    clearTokens();
    return null;
  }

  let json: ApiResponse<{
    tokens?: AuthTokens;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  }>;
  try {
    json = await readApiJson(response);
  } catch {
    clearTokens();
    return null;
  }
  if (json.success && json.data) {
    const tokens: AuthTokens = json.data.tokens ?? {
      accessToken: json.data.accessToken ?? '',
      refreshToken: json.data.refreshToken ?? refreshToken,
      expiresIn: json.data.expiresIn ?? 900,
    };
    if (!tokens.accessToken) {
      clearTokens();
      return null;
    }
    setTokens(tokens);
    return tokens.accessToken;
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
  /** Multipart body — skips JSON Content-Type so the browser sets the boundary. */
  formData?: FormData;
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

export interface ApiPage<T> {
  data: T;
  meta?: ApiResponse<T>['meta'];
}

/**
 * The TLS proxy in front of the API returns an HTML error page (often 413)
 * when a body exceeds its limit. `response.json()` then throws
 * `Unexpected token '<'... is not valid JSON`.
 */
async function readApiJson<T>(response: Response): Promise<ApiResponse<T>> {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new ApiError(`Request failed (${response.status})`, 'EMPTY_RESPONSE', response.status);
  }
  try {
    return JSON.parse(trimmed) as ApiResponse<T>;
  } catch {
    if (response.status === 413 || /413 Request Entity Too Large/i.test(trimmed)) {
      throw new ApiError(
        'That file is too large for the server. Use an image under 1 MB, or save again so it can be reduced.',
        'PAYLOAD_TOO_LARGE',
        413,
      );
    }
    if (response.status === 502 || response.status === 504) {
      throw new ApiError(
        'The server did not finish the upload. Try again in a moment.',
        'BAD_GATEWAY',
        response.status,
      );
    }
    throw new ApiError(
      `The server returned an unexpected response (${response.status}).`,
      'INVALID_RESPONSE',
      response.status || 500,
    );
  }
}

async function requestEnvelope<T>(path: string, options: RequestOptions = {}): Promise<ApiPage<T>> {
  const { body, formData, params, headers, ...rest } = options;

  const doFetch = async (token: string | null) => {
    const requestHeaders: Record<string, string> = {
      ...(headers as Record<string, string>),
    };

    if (body !== undefined && !formData) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }

    const organizationId = getOrganizationId();
    if (organizationId) {
      requestHeaders[ORGANIZATION_HEADER] = organizationId;
    }

    return fetch(buildUrl(path, params), {
      ...rest,
      headers: requestHeaders,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
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

  const json = await readApiJson<T>(response);

  if (!response.ok || !json.success) {
    throw new ApiError(
      json.error?.message ?? `Request failed (${response.status})`,
      json.error?.code ?? 'UNKNOWN',
      response.status,
      json.error?.details,
    );
  }

  return { data: json.data as T, meta: json.meta };
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const page = await requestEnvelope<T>(path, options);
  return page.data;
}

export const api = {
  get: <T>(path: string, params?: RequestOptions['params']) =>
    apiRequest<T>(path, { method: 'GET', params }),
  getPage: <T>(path: string, params?: RequestOptions['params']) =>
    requestEnvelope<T>(path, { method: 'GET', params }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};

/**
 * Authenticated fetch for binary downloads (PDF/CSV). Includes Bearer + org header.
 * Does not parse JSON — callers read `response.blob()` / `arrayBuffer()`.
 */
export async function apiFetch(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const { body, formData, params, headers, ...rest } = options;

  const doFetch = async (token: string | null) => {
    const requestHeaders: Record<string, string> = {
      ...(headers as Record<string, string>),
    };
    if (body !== undefined && !formData) {
      requestHeaders['Content-Type'] = 'application/json';
    }
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
    const organizationId = getOrganizationId();
    if (organizationId) {
      requestHeaders[ORGANIZATION_HEADER] = organizationId;
    }
    return fetch(buildUrl(path, params), {
      ...rest,
      headers: requestHeaders,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
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

  return response;
}
