import { describe, expect, it } from 'vitest';
import {
  blogSlugFromPath,
  composeCompetitionBlog,
  renderBlogArticleHtml,
  type CompetitionBlogFacts,
} from '../services/blog-article.js';
import { normalizePublicPath } from '../services/seo.service.js';

const facts: CompetitionBlogFacts = {
  name: 'Spring Accuracy Open',
  slug: 'spring-open',
  organizer: 'Ridge Club',
  venue: 'Hill Field',
  country: 'Exampleland',
  startDate: new Date('2026-05-01T00:00:00.000Z'),
  endDate: new Date('2026-05-03T00:00:00.000Z'),
  pilotCount: 24,
  officialRoundCount: 6,
  podium: [
    { place: 1, name: 'Ada Flyer', scoreLabel: '042 cm', country: 'Exampleland' },
    { place: 2, name: 'Bo Pilot', scoreLabel: '088 cm', country: '' },
  ],
  womenWinner: { place: 1, name: 'Cee Wing', scoreLabel: '101 cm', country: 'Elsewhere' },
  teamWinner: { place: 1, name: 'North Team', scoreLabel: '210 cm', country: 'Exampleland' },
  resultsUrl: 'https://results.example/competition/spring-open/results',
};

describe('blogSlugFromPath', () => {
  it('keeps blog paths out of the competition parser', () => {
    expect(blogSlugFromPath(normalizePublicPath('/blog'))).toBe('index');
    expect(blogSlugFromPath(normalizePublicPath('/blog/'))).toBe('index');
    expect(blogSlugFromPath(normalizePublicPath('/blog/spring-open'))).toBe('spring-open');
    expect(blogSlugFromPath(normalizePublicPath('/blog/spring-open/'))).toBe('spring-open');
    expect(blogSlugFromPath(normalizePublicPath('/competition/spring-open'))).toBeNull();
    expect(blogSlugFromPath(normalizePublicPath('/events/competition/spring-open'))).toBeNull();
  });
});

describe('composeCompetitionBlog', () => {
  it('writes the event, podium, classifications and results link from competition data', () => {
    const article = composeCompetitionBlog(facts);
    expect(article.title).toBe('Spring Accuracy Open results');
    expect(article.slug).toBe('spring-open');
    expect(article.paragraphs[0]).toContain('Spring Accuracy Open is complete');
    expect(article.paragraphs[0]).toContain('Ridge Club');
    expect(article.paragraphs[0]).toContain('Hill Field, Exampleland');
    expect(article.paragraphs[0]).toContain('24 pilots flew 6 official rounds');
    expect(article.paragraphs.join(' ')).toContain('Ada Flyer (Exampleland) finished first');
    expect(article.paragraphs.join(' ')).toContain('Bo Pilot finished second');
    expect(article.paragraphs.join(' ')).toContain(
      "Cee Wing (Elsewhere) won the women's classification",
    );
    expect(article.paragraphs.join(' ')).toContain('North Team (Exampleland) won the team classification');
    expect(article.resultsUrl).toContain('/competition/spring-open/results');

    const html = renderBlogArticleHtml(article);
    expect(html).toContain('Official results');
    expect(html).toContain('https://results.example/competition/spring-open/results');
    expect(html).not.toContain('<script');
  });

  it('still publishes a story when rankings are not available', () => {
    const article = composeCompetitionBlog({
      ...facts,
      name: 'Open <Final>',
      podium: [],
      womenWinner: null,
      teamWinner: null,
      pilotCount: 0,
      officialRoundCount: 0,
    });
    expect(article.paragraphs).toHaveLength(2);
    expect(article.paragraphs[0]).not.toContain('finished first');
    const html = renderBlogArticleHtml(article);
    expect(html).toContain('Open &lt;Final&gt;');
    expect(html).not.toContain('<Final>');
  });

  it('does not repeat the results word when the competition name already ends with it', () => {
    const article = composeCompetitionBlog({ ...facts, name: 'Valley Results' });
    expect(article.title).toBe('Valley Results');
  });
});
