import { env } from '../config/env.js';

/** Build a full URL for a path under /uploads/... */
export function buildUploadUrl(...segments: string[]): string {
  const path = ['uploads', ...segments]
    .map((s) => s.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
  return `${env.publicApiUrl}/${path}`;
}

/**
 * Normalize a stored asset path to an absolute URL.
 * Already-absolute http(s) URLs are returned unchanged.
 */
export function toAbsoluteAssetUrl(url: string | null | undefined): string | null {
  if (url == null || url === '') return null;
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${env.publicApiUrl}${path}`;
}
