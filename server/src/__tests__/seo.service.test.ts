import { describe, expect, it } from 'vitest';
import { blogSlugFromPath } from '../services/blog-article.js';
import { pilotCareerUrl } from '../services/blog.service.js';
import {
  buildFeedItemSeo,
  feedItemFromPath,
  imageSizeFromHeaders,
  normalizePublicPath,
  pilotIdFromPath,
  renderSeoHtml,
} from '../services/seo.service.js';

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
    expect(pilotIdFromPath(normalizePublicPath('/events/pilots/001'))).toBe('001');
    expect(pilotIdFromPath(normalizePublicPath('/events/competition/abc/pilots/4'))).toBeNull();
  });

  it('builds a pilot career url on the events app, with a return to the story', () => {
    const href = pilotCareerUrl('001', { storySlug: 'spring-open', competitionId: 'comp-1' });
    const url = new URL(href);
    expect(url.pathname).toBe('/pilots/001');
    expect(url.searchParams.get('story')).toBe('http://localhost:3004/blog/spring-open');
    expect(url.searchParams.get('competition')).toBe('comp-1');
  });

  it('reads a feed update from /events/competition/:slug/feed/:id', () => {
    expect(feedItemFromPath(normalizePublicPath('/events/competition/cup/feed/post-1'))).toEqual({
      slug: 'cup',
      itemId: 'post-1',
    });
    expect(
      feedItemFromPath(
        normalizePublicPath(
          '/events/competition/cup/feed/cmwq2brb50001apmiuz2vu47lOpening%20ceremony%20ongoing',
        ),
      ),
    ).toEqual({
      slug: 'cup',
      itemId: 'cmwq2brb50001apmiuz2vu47l',
    });
    expect(feedItemFromPath(normalizePublicPath('/events/competition/cup/feed'))).toBeNull();
  });

  it('builds photo-post metadata search engines and share previews can read', () => {
    const meta = buildFeedItemSeo({
      slug: 'sikkim-cup',
      item: {
        id: 'post-1',
        kind: 'PHOTO',
        caption: 'Welcome to Team Everest all the way from Nepal.',
        body: 'Pilots: Yubaraj, Roshan, Pawan and Sagar.',
        imageUrl: 'https://cdn.example/team-everest.jpg',
        pilotName: null,
        scoreText: null,
        roundNumber: null,
        createdAt: '2026-11-21T06:40:00.000Z',
      },
      competition: {
        name: 'Sikkim Paragliding Accuracy Cup',
        venue: 'Gangtok',
        country: 'India',
      },
    });

    expect(meta.title).toContain('Team Everest');
    expect(meta.title).toContain('Paragliding Accuracy');
    expect(meta.description).toContain('paragliding accuracy');
    expect(meta.image).toBe('https://cdn.example/team-everest.jpg');
    expect(meta.url).toContain('/competition/sikkim-cup/feed/post-1');
    expect(meta.articleHtml).toContain('alt="Welcome to Team Everest');
    expect(meta.jsonLd).toMatchObject({
      '@type': 'ImageObject',
      contentUrl: 'https://cdn.example/team-everest.jpg',
      about: { sport: 'Paragliding Accuracy' },
    });
  });

  it('reads the pixel size Facebook needs before it will draw a share image', () => {
    const headers = new Headers({
      'content-type': 'image/jpeg',
      'server-timing':
        'content-info;desc="width=1189,height=754,bytes=121519,format=jpg"',
    });
    expect(imageSizeFromHeaders(headers)).toEqual({
      width: 1189,
      height: 754,
      type: 'image/jpeg',
    });
    expect(imageSizeFromHeaders(new Headers())).toBeNull();
  });

  it('prints the image size on the crawler page', () => {
    const html = renderSeoHtml({
      title: 'Team Everest',
      description: 'Welcome',
      url: 'https://paraglidingaccuracy.org/events/competition/cup/feed/post-1',
      image: 'https://res.cloudinary.com/example/team.jpg',
      imageWidth: 1189,
      imageHeight: 754,
      imageType: 'image/jpeg',
      siteName: 'AeroJudge',
      type: 'article',
    });
    expect(html).toContain('<meta property="og:image:width" content="1189" />');
    expect(html).toContain('<meta property="og:image:height" content="754" />');
    expect(html).toContain('<meta property="og:image:type" content="image/jpeg" />');
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
