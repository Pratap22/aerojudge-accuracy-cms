import path from 'node:path';
import { env } from '../config/env.js';

/** Build a full URL for a path under /uploads/... */
export function buildUploadUrl(...segments: string[]): string {
  const uploadPath = ['uploads', ...segments]
    .map((s) => s.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
  return `${env.publicApiUrl}/${uploadPath}`;
}

/**
 * Normalize a stored asset path to an absolute URL.
 * Already-absolute http(s) URLs are returned unchanged.
 */
export function toAbsoluteAssetUrl(url: string | null | undefined): string | null {
  if (url == null || url === '') return null;
  if (/^https?:\/\//i.test(url)) return url;
  const assetPath = url.startsWith('/') ? url : `/${url}`;
  return `${env.publicApiUrl}${assetPath}`;
}

/**
 * Map a stored /uploads URL to a local filesystem path under UPLOAD_DIR.
 * Returns null when the URL is missing, external, or escapes the upload root.
 */
export function resolveLocalUploadPath(url: string | null | undefined): string | null {
  if (url == null || url === '') return null;

  let pathname = url;
  if (/^https?:\/\//i.test(url)) {
    try {
      pathname = new URL(url).pathname;
    } catch {
      return null;
    }
  }

  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const marker = '/uploads/';
  const idx = normalized.indexOf(marker);
  if (idx === -1) return null;

  const relative = normalized.slice(idx + marker.length);
  if (!relative || relative.includes('..')) return null;

  const resolved = path.resolve(env.uploadDir, relative);
  const root = env.uploadDir;
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return null;
  }
  return resolved;
}
