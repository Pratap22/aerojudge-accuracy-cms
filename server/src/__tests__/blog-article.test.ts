import { describe, expect, it } from 'vitest';
import {
  blogSlugFromPath,
  composeCompetitionBlog,
  renderBlogArticleHtml,
  type BlogPlace,
  type CompetitionBlogArticle,
  type CompetitionBlogFacts,
} from '../services/blog-article.js';
import { normalizePublicPath } from '../services/seo.service.js';

function place(partial: Partial<BlogPlace> & Pick<BlogPlace, 'place' | 'name' | 'scoreCm'>): BlogPlace {
  return {
    scoreLabel: `${String(partial.scoreCm).padStart(3, '0')} cm`,
    country: '',
    roundsFlown: 6,
    bullseyes: 0,
    imageUrl: '',
    profileUrl: '',
    ...partial,
  };
}

const facts: CompetitionBlogFacts = {
  name: 'Spring Accuracy Open',
  slug: 'spring-open',
  organizer: 'Ridge Club',
  venue: 'Hill Field',
  country: 'Exampleland',
  startDate: new Date('2026-05-01T00:00:00.000Z'),
  endDate: new Date('2026-05-03T00:00:00.000Z'),
  pilotCount: 24,
  teamCount: 4,
  officialRoundCount: 6,
  rankings: [
    place({
      place: 1,
      name: 'Ada Flyer',
      scoreCm: 42,
      country: 'Exampleland',
      bullseyes: 2,
      imageUrl: 'https://images.example/ada.jpg',
      profileUrl: 'https://results.example/competition/spring-open/pilots/6',
    }),
    place({ place: 2, name: 'Bo Pilot', scoreCm: 88 }),
    place({ place: 3, name: 'Cee Wing', scoreCm: 101, country: 'Elsewhere' }),
  ],
  womenRanking: [
    place({ place: 1, name: 'Cee Wing', scoreCm: 101, country: 'Elsewhere' }),
    place({ place: 2, name: 'Dee Ridge', scoreCm: 140, country: 'Exampleland' }),
  ],
  womenPilotCount: 2,
  womenCategoryEnabled: true,
  teamRanking: [place({ place: 1, name: 'North Team', scoreCm: 210, country: 'Exampleland', bullseyes: 0 })],
  officials: [
    {
      name: 'Eve Judge',
      role: 'Meet Director',
      imageUrl: 'https://images.example/eve.jpg',
      profileUrl: 'https://results.example/competition/spring-open/profile/EVE',
    },
  ],
  countries: [
    { name: 'Exampleland', pilotCount: 18 },
    { name: 'Elsewhere', pilotCount: 6 },
  ],
  rounds: [
    { number: 1, label: 'Round 1', dateLabel: '1 May 2026', averageLabel: '140.5 cm', bullseyes: 1 },
    { number: 2, label: 'Round 2', dateLabel: '2 May 2026', averageLabel: '90 cm', bullseyes: 4 },
  ],
  totalBullseyes: 5,
  bestSingle: { name: 'Ada Flyer', scoreCm: 0, scoreLabel: '000 cm', roundNumber: 2 },
  scoring: {
    maximumScoreCm: 500,
    discardWorstRounds: 1,
    discardAfterRounds: 5,
    targetDiameterCm: 200,
    teamSize: 5,
    teamScoringPilots: 3,
  },
  aboutParagraphs: ['The meet uses the valley landing field below the west ridge.'],
  flyingSiteParagraphs: ['The target sits in the main landing meadow.'],
  partnersLabel: 'Supporters',
  partnerNames: ['Northwind', 'Ridge Co'],
  photos: [{ src: 'https://images.example/meet.jpg', alt: 'Target <view>', caption: 'Target <view>' }],
  photoSource: 'feed',
  related: [{ slug: 'other-open', title: 'Other Open results' }],
  resultsUrl: 'https://results.example/competition/spring-open/results',
  womenUrl: 'https://results.example/competition/spring-open/women',
  teamsUrl: 'https://results.example/competition/spring-open/teams',
};

function articleText(article: CompetitionBlogArticle): string {
  return [
    ...article.paragraphs,
    ...article.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
      ...(section.table?.rows.flat() ?? []),
    ]),
    ...article.faqs.flatMap((faq) => [faq.question, faq.answer]),
  ].join('\n');
}

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
  it('writes a full results story from the official competition record', () => {
    const article = composeCompetitionBlog(facts);
    const text = articleText(article);
    expect(article.title).toBe('Spring Accuracy Open results');
    expect(text).toContain('Ridge Club');
    expect(text).toContain('Hill Field, Exampleland');
    expect(text).toContain('24 pilots and 4 teams competed across 6 official rounds');
    expect(text).toContain('24 pilots from 2 countries');
    expect(text).toContain('Ada Flyer (Exampleland) finished first');
    expect(text).toContain('46 cm ahead of Bo Pilot');
    expect(text).toContain("Cee Wing (Elsewhere) won the women's classification");
    expect(text).toContain('Eve Judge (Meet Director)');
    expect(text).toContain('North Team (Exampleland) won the team classification');
    expect(text).toContain('best 3 of 5 pilots');
    expect(text).toContain('Round 2 was the tightest round');
    expect(text).toContain('worst score was discarded');
    expect(text).toContain('valley landing field');
    expect(text).toContain('Supporters of Spring Accuracy Open: Northwind and Ridge Co.');
    expect(text).toContain('Who won Spring Accuracy Open?');
    expect(text.length).toBeGreaterThan(1200);

    const html = renderBlogArticleHtml(article);
    expect(html).toContain('<h2>Overall results</h2>');
    expect(html).toContain('<table>');
    expect(html).toContain('Who won Spring Accuracy Open?');
    expect(html).toContain('https://results.example/competition/spring-open/results');
    expect(html).toContain('/blog/other-open');
    expect(html).toContain('https://images.example/eve.jpg');
    expect(html).toContain('https://images.example/ada.jpg');
    expect(html).toContain('href="https://results.example/competition/spring-open/pilots/6"');
    expect(html).toContain('href="https://results.example/competition/spring-open/profile/EVE"');
    expect(html).toContain('https://images.example/meet.jpg');
    expect(html).toContain('Target &lt;view&gt;');
    expect(html).not.toContain('<script');
    expect(article.coverImage).toBe('https://images.example/ada.jpg');
  });

  it('ignores portrait and feed urls that are not http(s)', () => {
    const article = composeCompetitionBlog({
      ...facts,
      rankings: [place({ place: 1, name: 'Ada Flyer', scoreCm: 42, imageUrl: 'javascript:alert(1)' })],
      womenRanking: [],
      teamRanking: [],
      photos: [{ src: 'javascript:alert(1)', alt: 'bad', caption: 'bad' }],
      photoSource: 'feed',
    });
    const html = renderBlogArticleHtml(article);
    expect(html).not.toContain('javascript:');
    expect(article.coverImage).toBe('');
    expect(article.sections.find((section) => section.id === 'photos')).toBeUndefined();
  });

  it('still publishes a story when rankings are not available', () => {
    const article = composeCompetitionBlog({
      ...facts,
      name: 'Open <Final>',
      rankings: [],
      womenRanking: [],
      womenPilotCount: 0,
      womenCategoryEnabled: false,
      teamRanking: [],
      officials: [],
      countries: [],
      rounds: [],
      totalBullseyes: 0,
      bestSingle: null,
      scoring: null,
      aboutParagraphs: [],
      flyingSiteParagraphs: [],
      partnerNames: [],
      photos: [],
      photoSource: 'none',
      pilotCount: 0,
      teamCount: 0,
      officialRoundCount: 0,
    });
    const text = articleText(article);
    expect(text).not.toContain('finished first');
    expect(article.sections.some((section) => section.id === 'results')).toBe(true);
    const html = renderBlogArticleHtml(article);
    expect(html).toContain('Open &lt;Final&gt;');
    expect(html).not.toContain('<Final>');
  });

  it('lists an official once, under the higher role', () => {
    const article = composeCompetitionBlog({
      ...facts,
      officials: [
        {
          name: 'Pratap Sharma',
          role: 'Scorer',
          imageUrl: 'https://images.example/pratap.jpg',
          profileUrl: 'https://results.example/competition/spring-open/profile/PS',
        },
        { name: 'Pratap Sharma', role: 'Target Judge', imageUrl: '', profileUrl: '' },
        { name: 'Eve Judge', role: 'Meet Director', imageUrl: '', profileUrl: '' },
      ],
    });
    const section = article.sections.find((item) => item.id === 'officials');
    expect(section?.table?.rows).toEqual([
      ['Meet Director', 'Eve Judge'],
      ['Target Judge', 'Pratap Sharma'],
    ]);
    expect(articleText(article)).not.toContain('Scorer');
    expect(section?.figures?.map((figure) => figure.caption)).toEqual(['Pratap Sharma — Target Judge']);
    expect(section?.figures?.[0]?.href).toBe('https://results.example/competition/spring-open/profile/PS');
  });

  it('does not call a sole female pilot the winner of the women classification', () => {
    const alone = composeCompetitionBlog({
      ...facts,
      womenPilotCount: 1,
      womenRanking: [place({ place: 1, name: 'Cee Wing', scoreCm: 101, country: 'Elsewhere' })],
    });
    const text = articleText(alone);
    expect(text).toContain('Only one female pilot competed, Cee Wing (Elsewhere)');
    expect(text).not.toContain("won the women's classification");
    expect(alone.sections.find((section) => section.id === 'women')?.table).toBeUndefined();

    const none = composeCompetitionBlog({
      ...facts,
      womenPilotCount: 0,
      womenRanking: [],
      womenCategoryEnabled: true,
    });
    expect(articleText(none)).toContain('No female pilots competed');
  });

  it('does not repeat the results word when the competition name already ends with it', () => {
    const article = composeCompetitionBlog({ ...facts, name: 'Valley Results' });
    expect(article.title).toBe('Valley Results');
  });
});
