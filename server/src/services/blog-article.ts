export type BlogPlace = {
  place: number;
  name: string;
  scoreLabel: string;
  country: string;
};

export type CompetitionBlogFacts = {
  name: string;
  slug: string;
  organizer: string;
  venue: string;
  country: string;
  startDate: Date;
  endDate: Date;
  pilotCount: number;
  officialRoundCount: number;
  podium: BlogPlace[];
  womenWinner: BlogPlace | null;
  teamWinner: BlogPlace | null;
  resultsUrl: string;
};

export type CompetitionBlogArticle = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  organizer: string;
  venue: string;
  country: string;
  startDate: string;
  endDate: string;
  paragraphs: string[];
  podium: BlogPlace[];
  womenWinner: BlogPlace | null;
  teamWinner: BlogPlace | null;
  resultsUrl: string;
};

export type CompetitionBlogSummary = Pick<
  CompetitionBlogArticle,
  | 'slug'
  | 'title'
  | 'description'
  | 'publishedAt'
  | 'organizer'
  | 'venue'
  | 'country'
  | 'startDate'
  | 'endDate'
>;

const RANK_WORDS: Record<number, string> = {
  1: 'first',
  2: 'second',
  3: 'third',
};

/** `/blog` → index, `/blog/:slug` → slug, anything else → null. */
export function blogSlugFromPath(path: string): 'index' | string | null {
  if (path === '/blog') return 'index';
  const match = path.match(/^\/blog\/([^/]+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function composeCompetitionBlog(facts: CompetitionBlogFacts): CompetitionBlogArticle {
  const name = facts.name.trim();
  const organizer = facts.organizer.trim();
  const venue = facts.venue.trim();
  const country = facts.country.trim();
  const place = [venue, country].filter(Boolean).join(', ');
  const dates = formatDateRange(facts.startDate, facts.endDate);
  const hosted = organizer
    ? `${organizer} hosted the paragliding accuracy competition`
    : 'The paragliding accuracy competition was held';
  const setting = [place ? `at ${place}` : '', dates ? `from ${dates}` : ''].filter(Boolean).join(' ');
  const scale = scaleSentence(facts.pilotCount, facts.officialRoundCount);
  const intro = `${name} is complete. ${hosted}${setting ? ` ${setting}` : ''}.${scale}`;

  const paragraphs = [intro];
  const podiumParagraph = podiumSentence(facts.podium);
  if (podiumParagraph) paragraphs.push(podiumParagraph);

  if (facts.womenWinner) {
    const sameAsOverall = facts.podium[0]?.name === facts.womenWinner.name;
    const where = facts.womenWinner.country ? ` (${facts.womenWinner.country})` : '';
    paragraphs.push(
      sameAsOverall
        ? `${facts.womenWinner.name} also won the women's classification with a total of ${facts.womenWinner.scoreLabel}.`
        : `${facts.womenWinner.name}${where} won the women's classification with a total of ${facts.womenWinner.scoreLabel}.`,
    );
  }

  if (facts.teamWinner) {
    const where = facts.teamWinner.country ? ` (${facts.teamWinner.country})` : '';
    paragraphs.push(
      `${facts.teamWinner.name}${where} won the team classification with a total of ${facts.teamWinner.scoreLabel}.`,
    );
  }

  paragraphs.push('Round scores, the full ranking and the pilot list are on the official results page.');

  const title = /results$/i.test(name) ? name : `${name} results`;

  return {
    slug: facts.slug,
    title,
    description: metaDescription(intro),
    publishedAt: facts.endDate.toISOString(),
    organizer,
    venue,
    country,
    startDate: facts.startDate.toISOString(),
    endDate: facts.endDate.toISOString(),
    paragraphs,
    podium: facts.podium,
    womenWinner: facts.womenWinner,
    teamWinner: facts.teamWinner,
    resultsUrl: facts.resultsUrl,
  };
}

export function toBlogSummary(article: CompetitionBlogArticle): CompetitionBlogSummary {
  return {
    slug: article.slug,
    title: article.title,
    description: article.description,
    publishedAt: article.publishedAt,
    organizer: article.organizer,
    venue: article.venue,
    country: article.country,
    startDate: article.startDate,
    endDate: article.endDate,
  };
}

export function renderBlogArticleHtml(article: CompetitionBlogArticle): string {
  const paragraphs = article.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n');
  const podium = article.podium.length
    ? `<ol>\n${article.podium
        .map((row) => {
          const country = row.country ? ` (${escapeHtml(row.country)})` : '';
          return `<li>${escapeHtml(row.name)}${country} — ${escapeHtml(row.scoreLabel)}</li>`;
        })
        .join('\n')}\n</ol>`
    : '';
  const link = `<p><a href="${escapeHtml(article.resultsUrl)}">Official results</a></p>`;
  return [paragraphs, podium, link].filter(Boolean).join('\n');
}

export function renderBlogIndexHtml(posts: CompetitionBlogSummary[]): string {
  const intro =
    '<p>Written recaps of completed paragliding accuracy competitions, published when official results are public.</p>';
  if (posts.length === 0) {
    return `${intro}\n<p>No completed competitions are public yet.</p>`;
  }
  const items = posts
    .map(
      (post) =>
        `<li><a href="/blog/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></li>`,
    )
    .join('\n');
  return `${intro}\n<ul>\n${items}\n</ul>`;
}

function scaleSentence(pilotCount: number, officialRoundCount: number): string {
  if (pilotCount > 0 && officialRoundCount > 0) {
    return ` ${pilotCount} ${plural(pilotCount, 'pilot')} flew ${officialRoundCount} official ${plural(officialRoundCount, 'round')}.`;
  }
  if (officialRoundCount > 0) {
    return ` The meet included ${officialRoundCount} official ${plural(officialRoundCount, 'round')}.`;
  }
  if (pilotCount > 0) {
    return ` ${pilotCount} ${plural(pilotCount, 'pilot')} competed.`;
  }
  return '';
}

function podiumSentence(podium: BlogPlace[]): string | null {
  if (podium.length === 0) return null;
  return podium
    .map((row) => {
      const where = row.country ? ` (${row.country})` : '';
      const place = RANK_WORDS[row.place] ?? `in position ${row.place}`;
      return `${row.name}${where} finished ${place} with a total of ${row.scoreLabel}.`;
    })
    .join(' ');
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}

function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  try {
    if (start.toDateString() === end.toDateString()) {
      return start.toLocaleDateString('en-GB', opts);
    }
    return `${start.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', opts)}`;
  } catch {
    return '';
  }
}

function metaDescription(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 160) return clean;
  const cut = clean.slice(0, 157);
  const space = cut.lastIndexOf(' ');
  return `${(space > 80 ? cut.slice(0, space) : cut).trim()}…`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
