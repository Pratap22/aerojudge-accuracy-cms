import { API_VERSION, type ApiResponse } from '@aero-judge/shared';

/** Thrown when a public API call fails or the device cannot reach the server. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Normalize the API origin. The value is the site origin, not a path.
 * Example: `https://aerojudge.nepalabs.com`.
 */
export function resolveApiBaseUrl(configured: string | undefined): string {
  const base = (configured ?? '').trim().replace(/\/+$/, '');
  if (!base) {
    throw new ApiError(0, 'EXPO_PUBLIC_API_URL is not set.');
  }
  return base;
}

/** Build a public API URL from an origin, path, and query string. */
export function publicApiUrl(base: string, path: string, params?: Record<string, string>): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`/api/${API_VERSION}/public${suffix}`, resolveApiBaseUrl(base));
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

/** Read the standard `{ success, data, error }` envelope. */
export function readApiData<T>(status: number, body: unknown): T {
  if (!body || typeof body !== 'object') {
    throw new ApiError(
      status || 0,
      status ? `Request failed (${status}).` : 'The server sent an unreadable response.',
    );
  }

  const json = body as ApiResponse<T>;
  if (status < 200 || status >= 300 || !json.success || json.data === undefined) {
    throw new ApiError(
      status || 0,
      json.error?.message ?? `Request failed (${status || 'unknown'}).`,
    );
  }

  return json.data;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Something went wrong.';
}
