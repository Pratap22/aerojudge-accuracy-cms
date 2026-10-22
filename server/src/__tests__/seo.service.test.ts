import { describe, expect, it } from 'vitest';
import { blogSlugFromPath } from '../services/blog-article.js';
import { pilotCareerUrl } from '../services/blog.service.js';
import { normalizePublicPath, pilotIdFromPath } from '../services/seo.service.js';

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

  it('reads a pilot id from /events/pilots/:id and not from a competition bib page', () => {
    expect(pilotIdFromPath(normalizePublicPath('/events/pilots/AJ-1'))).toBe('AJ-1');
    expect(pilotIdFromPath(normalizePublicPath('/events/competition/abc/pilots/4'))).toBeNull();
  });

  it('builds a pilot career url on the events app, with a return to the story', () => {
    const href = pilotCareerUrl('AJ-1', { storySlug: 'spring-open', competitionId: 'comp-1' });
    const url = new URL(href);
    expect(url.pathname).toBe('/pilots/AJ-1');
    expect(url.searchParams.get('story')).toBe('http://localhost:3004/blog/spring-open');
    expect(url.searchParams.get('competition')).toBe('comp-1');
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
