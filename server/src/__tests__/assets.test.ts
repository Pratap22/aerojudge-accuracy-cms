import { describe, expect, it } from 'vitest';
import { buildUploadUrl, toAbsoluteAssetUrl } from '../utils/assets.js';

describe('buildUploadUrl', () => {
  it('stores a host-relative /uploads path', () => {
    expect(buildUploadUrl('hero', 'comp1', 'a.png')).toBe('/uploads/hero/comp1/a.png');
  });

  it('strips stray slashes from segments', () => {
    expect(buildUploadUrl('/organizations/', '/org1/', '/logo.jpg')).toBe(
      '/uploads/organizations/org1/logo.jpg',
    );
  });
});

describe('toAbsoluteAssetUrl', () => {
  it('prefixes relative upload paths with PUBLIC_API_URL', () => {
    const absolute = toAbsoluteAssetUrl('/uploads/hero/comp1/a.png');
    expect(absolute).toMatch(/^https?:\/\//);
    expect(absolute?.endsWith('/uploads/hero/comp1/a.png')).toBe(true);
  });

  it('leaves already-absolute URLs unchanged', () => {
    expect(toAbsoluteAssetUrl('https://cdn.example/photo.jpg')).toBe(
      'https://cdn.example/photo.jpg',
    );
  });

  it('returns null for empty values', () => {
    expect(toAbsoluteAssetUrl(null)).toBeNull();
    expect(toAbsoluteAssetUrl('')).toBeNull();
  });
});
