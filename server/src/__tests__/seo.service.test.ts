import { describe, expect, it } from 'vitest';
import { blogSlugFromPath } from '../services/blog-article.js';
import { normalizePublicPath } from '../services/seo.service.js';

describe('normalizePublicPath', () => {
  it('strips /events prefix', () => {
    expect(normalizePublicPath('/events/competition/abc/results')).toBe(
      '/competition/abc/results',
    );
    expect(normalizePublicPath('/events/')).toBe('/');
    expect(normalizePublicPath('/events')).toBe('/');
  });

  it('strips legacy /results prefix', () => {
    expect(normalizePublicPath('/results/competition/abc/results')).toBe(
      '/competition/abc/results',
    );
    expect(normalizePublicPath('/results/')).toBe('/');
    expect(normalizePublicPath('/results')).toBe('/');
  });

  it('keeps competition paths without prefix', () => {
    expect(normalizePublicPath('/competition/abc')).toBe('/competition/abc');
  });

  it('leaves /blog paths for the story resolver', () => {
    expect(blogSlugFromPath(normalizePublicPath('/blog'))).toBe('index');
    expect(blogSlugFromPath(normalizePublicPath('/blog/spring-open/'))).toBe('spring-open');
    expect(normalizePublicPath('/blog/spring-open')).toBe('/blog/spring-open');
  });

  it('strips query and trailing slash', () => {
    expect(normalizePublicPath('/events/competition/abc/?utm=1')).toBe('/competition/abc');
    expect(normalizePublicPath('/results/competition/abc/?utm=1')).toBe('/competition/abc');
  });
});
