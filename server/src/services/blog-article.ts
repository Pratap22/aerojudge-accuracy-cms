import { officialRoleRank } from '@aero-judge/shared';

export type BlogPlace = {
  place: number;
  name: string;
  scoreCm: number;
  scoreLabel: string;
  country: string;
  roundsFlown: number;
  bullseyes: number;
  imageUrl: string;
  profileUrl: string;
};

export type BlogFigure = {
  src: string;
  alt: string;
  caption: string;
  href?: string;
};

export type BlogPhotoSource = 'feed' | 'gallery' | 'both' | 'none';

export type BlogRound = {
  number: number;
  label: string;
  dateLabel: string;
  averageLabel: string;
  bullseyes: number;
};

export type BlogCountry = {
  name: string;
  pilotCount: number;
};

export type BlogScoring = {
  maximumScoreCm: number;
  discardWorstRounds: number;
  discardAfterRounds: number;
  targetDiameterCm: number;
  teamSize: number;
  teamScoringPilots: number;
};

export type BlogBestScore = {
  name: string;
  scoreCm: number;
  scoreLabel: string;
  roundNumber: number;
};

export type BlogLink = {
  slug: string;
  title: string;
};

export type BlogOfficial = {
  name: string;
  role: string;
  imageUrl: string;
  profileUrl: string;
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
  teamCount: number;
  officialRoundCount: number;
  rankings: BlogPlace[];
  womenRanking: BlogPlace[];
  womenPilotCount: number;
  womenCategoryEnabled: boolean;
  teamRanking: BlogPlace[];
  officials: BlogOfficial[];
  countries: BlogCountry[];
  rounds: BlogRound[];
  totalBullseyes: number;
  bestSingle: BlogBestScore | null;
  scoring: BlogScoring | null;
  aboutParagraphs: string[];
  flyingSiteParagraphs: string[];
  partnersLabel: string;
  partnerNames: string[];
  photos: BlogFigure[];
  photoSource: BlogPhotoSource;
  related: BlogLink[];
  resultsUrl: string;
  womenUrl: string;
  teamsUrl: string;
};

export type BlogTable = {
  caption: string;
  headers: string[];
  rows: string[][];
};

export type BlogSection = {
  id: string;
  heading: string;
  paragraphs: string[];
  figures?: BlogFigure[];
  table?: BlogTable;
};

export type BlogFaq = {
  question: string;
  answer: string;
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
  sections: BlogSection[];
  faqs: BlogFaq[];
  related: BlogLink[];
  resultsUrl: string;
  coverImage: string;
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
  | 'coverImage'
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

export function blogTitle(name: string): string {
  const trimmed = name.trim();
  return /results$/i.test(trimmed) ? trimmed : `${trimmed} results`;
}

export function plainTextFromHtml(html: string | null | undefined, maxChars = 900): string[] {
  if (!html) return [];
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/(h\d|li|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) return [];
  const clipped = text.length > maxChars ? `${text.slice(0, maxChars).trim()}…` : text;
  return clipped
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, 4);
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
  const scale = scaleSentence(facts.pilotCount, facts.teamCount, facts.officialRoundCount);
  const intro = `${name} is complete. ${hosted}${setting ? ` ${setting}` : ''}.${scale} In paragliding accuracy the lowest total distance from the target wins, and every figure below is taken from the official results.`;

  const winner = facts.rankings.find((row) => row.place === 1) ?? facts.rankings[0];
  const description = metaDescription(
    winner
      ? `${intro} ${who(winner)} won with a total of ${winner.scoreLabel}.`
      : intro,
  );

  const sections = [
    overallSection(name, facts.rankings),
    photosSection(name, facts.photos, facts.photoSource),
    standoutSection(facts),
    womenSection(facts),
    teamSection(facts),
    fieldSection(facts),
    officialsSection(facts.officials),
    roundsSection(facts.rounds),
    scoringSection(name, facts.scoring),
    copySection('about', 'About the competition', facts.aboutParagraphs),
    copySection('site', 'The flying site', facts.flyingSiteParagraphs),
    partnersSection(name, facts.partnersLabel, facts.partnerNames),
    resultsSection(name, facts.resultsUrl),
  ].filter((section): section is BlogSection => section !== null);

  return {
    slug: facts.slug,
    title: blogTitle(name),
    description,
    publishedAt: facts.endDate.toISOString(),
    organizer,
    venue,
    country,
    startDate: facts.startDate.toISOString(),
    endDate: facts.endDate.toISOString(),
    paragraphs: [intro],
    sections,
    faqs: buildFaqs(facts, winner ?? null, place, dates),
    related: facts.related,
    resultsUrl: facts.resultsUrl,
    coverImage: coverImage(facts),
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
    coverImage: article.coverImage,
  };
}

export function renderBlogArticleHtml(article: CompetitionBlogArticle): string {
  const lead = article.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n');
  const sections = article.sections
    .map((section) => {
      const heading = `<h2>${escapeHtml(section.heading)}</h2>`;
      const paragraphs = section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n');
      const figures = section.figures?.length ? renderFigures(section.figures) : '';
      const table = section.table ? renderTable(section.table) : '';
      return [heading, paragraphs, figures, table].filter(Boolean).join('\n');
    })
    .join('\n');
  const faqs = article.faqs.length
    ? `<h2>Common questions</h2>\n${article.faqs
        .map(
          (faq) => `<h3>${escapeHtml(faq.question)}</h3>\n<p>${escapeHtml(faq.answer)}</p>`,
        )
        .join('\n')}`
    : '';
  const related = article.related.length
    ? `<h2>More competition stories</h2>\n<ul>\n${article.related
        .map(
          (link) =>
            `<li><a href="/blog/${encodeURIComponent(link.slug)}">${escapeHtml(link.title)}</a></li>`,
        )
        .join('\n')}\n</ul>`
    : '';
  const link = `<p><a href="${escapeHtml(article.resultsUrl)}">Official results</a></p>`;
  return [lead, sections, faqs, related, link].filter(Boolean).join('\n');
}

export function renderBlogIndexHtml(posts: CompetitionBlogSummary[]): string {
  const intro =
    '<p>Written recaps of completed paragliding accuracy competitions. Each story covers the podium, the field, official rounds and how the result was scored, and it is published when the results are public.</p>';
  if (posts.length === 0) {
    return `${intro}\n<p>No completed competitions are public yet.</p>`;
  }
  const items = posts
    .map(
      (post) =>
        `<li><a href="/blog/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a><p>${escapeHtml(post.description)}</p></li>`,
    )
    .join('\n');
  return `${intro}\n<ul>\n${items}\n</ul>`;
}

function overallSection(name: string, rankings: BlogPlace[]): BlogSection | null {
  if (rankings.length === 0) return null;
  const shown = rankings.slice(0, 10);
  const podium = shown.filter((row) => row.place <= 3).slice(0, 3);
  const paragraphs = [podiumSentence(podium) ?? `${name} has an official individual ranking.`];
  const first = shown[0];
  const second = shown.find((row) => row.name !== first.name && row.place >= first.place);
  if (first && second) {
    const gap = Math.round((second.scoreCm - first.scoreCm) * 10) / 10;
    if (gap > 0) {
      paragraphs.push(`${first.name} finished ${cmLabel(gap)} ahead of ${second.name}.`);
    } else if (gap === 0) {
      paragraphs.push(`${first.name} and ${second.name} finished level on ${first.scoreLabel}.`);
    }
  }
  paragraphs.push(
    shown.length > 3
      ? `The table lists the top ${shown.length} in the overall classification. Lower totals are better.`
      : 'Lower totals are better. The full order is on the official results page.',
  );
  return {
    id: 'overall',
    heading: 'Overall results',
    paragraphs: paragraphs.filter(Boolean),
    figures: portraitFigures(podium, 'overall'),
    table: rankingTable(`${name} overall classification`, 'Pilot', shown, true),
  };
}

function photosSection(
  name: string,
  photos: BlogFigure[],
  source: BlogPhotoSource,
): BlogSection | null {
  const safe = photos.filter((photo) => safeImageUrl(photo.src));
  if (safe.length === 0 || source === 'none') return null;
  const where =
    source === 'both'
      ? 'the competition feed and the photo gallery'
      : source === 'gallery'
        ? 'the photo gallery'
        : 'the competition feed';
  return {
    id: 'photos',
    heading: 'From the meet',
    paragraphs: [
      `${safe.length} ${plural(safe.length, 'picture')} from ${where} at ${name}.`,
    ],
    figures: safe,
  };
}

function portraitFigures(rows: BlogPlace[], role: string): BlogFigure[] {
  return rows.slice(0, 3).flatMap((row) => {
    const src = safeImageUrl(row.imageUrl);
    if (!src) return [];
    const place = RANK_WORDS[row.place] ?? `place ${row.place}`;
    return [
      {
        src,
        alt: `${row.name}, ${place} ${role}`,
        caption: `${row.place}. ${who(row)} — ${row.scoreLabel}`,
        href: safeImageUrl(row.profileUrl) || undefined,
      },
    ];
  });
}

function coverImage(facts: CompetitionBlogFacts): string {
  return (
    portraitFigures(facts.rankings, 'overall')[0]?.src ||
    portraitFigures(facts.womenRanking, "women's")[0]?.src ||
    portraitFigures(facts.teamRanking, 'team')[0]?.src ||
    facts.photos.find((photo) => safeImageUrl(photo.src))?.src ||
    ''
  );
}

function standoutSection(facts: CompetitionBlogFacts): BlogSection | null {
  const paragraphs: string[] = [];
  if (facts.bestSingle) {
    const landing =
      facts.bestSingle.scoreCm === 0
        ? `${facts.bestSingle.name} recorded the closest official landing, a bullseye in round ${facts.bestSingle.roundNumber}.`
        : `${facts.bestSingle.name} recorded the closest official landing at ${facts.bestSingle.scoreLabel}, in round ${facts.bestSingle.roundNumber}.`;
    paragraphs.push(landing);
  }
  if (facts.totalBullseyes > 0) {
    paragraphs.push(
      `Pilots landed ${facts.totalBullseyes} ${plural(facts.totalBullseyes, 'bullseye')} across the official rounds. A bullseye is a dead-centre score and counts as 0 cm.`,
    );
  }
  const leader = facts.rankings[0];
  if (leader && leader.bullseyes > 0) {
    paragraphs.push(
      `${leader.name} recorded ${leader.bullseyes} ${plural(leader.bullseyes, 'bullseye')} on the way to the overall lead.`,
    );
  }
  if (paragraphs.length === 0) return null;
  return { id: 'standout', heading: 'Closest landings', paragraphs };
}

function womenSection(facts: CompetitionBlogFacts): BlogSection | null {
  const count = Math.max(facts.womenPilotCount, facts.womenRanking.length);
  if (!facts.womenCategoryEnabled && count === 0) return null;

  if (count > 1 && facts.womenRanking.length > 1) {
    return classificationSection(
      "Women's classification",
      'women',
      facts.womenRanking,
      facts.womenUrl,
      "women's",
    );
  }

  if (count === 1) {
    const pilot = facts.womenRanking[0];
    return {
      id: 'women',
      heading: "Women's classification",
      paragraphs: [
        pilot
          ? `Only one female pilot competed, ${who(pilot)}. She is not recorded as the winner of a women's classification.`
          : "Only one female pilot competed, so a women's classification was not awarded.",
      ],
      figures: pilot ? namedPortrait(pilot, 'female pilot') : [],
    };
  }

  if (count > 1) {
    return {
      id: 'women',
      heading: "Women's classification",
      paragraphs: [
        `${count} female pilots competed. A women's classification is published when more than one of them has a scored result.`,
      ],
    };
  }

  return {
    id: 'women',
    heading: "Women's classification",
    paragraphs: ["No female pilots competed, so a women's classification was not awarded."],
  };
}

function keepHighestOfficialRole(officials: BlogOfficial[]): BlogOfficial[] {
  const best = new Map<string, BlogOfficial>();
  for (const official of officials) {
    const key = official.name.trim().toLowerCase();
    if (!key) continue;
    const current = best.get(key);
    if (!current || officialRoleRank(official.role) < officialRoleRank(current.role)) {
      best.set(key, {
        ...official,
        imageUrl: official.imageUrl || current?.imageUrl || '',
        profileUrl: official.profileUrl || current?.profileUrl || '',
      });
    } else if ((!current.imageUrl && official.imageUrl) || (!current.profileUrl && official.profileUrl)) {
      best.set(key, {
        ...current,
        imageUrl: current.imageUrl || official.imageUrl,
        profileUrl: current.profileUrl || official.profileUrl,
      });
    }
  }
  return [...best.values()].sort(
    (a, b) => officialRoleRank(a.role) - officialRoleRank(b.role) || a.name.localeCompare(b.name),
  );
}

function officialsSection(officials: BlogOfficial[]): BlogSection | null {
  const unique = keepHighestOfficialRole(officials);
  if (unique.length === 0) return null;
  const listed = unique.map((official) => `${official.name} (${official.role})`);
  return {
    id: 'officials',
    heading: 'Officials',
    paragraphs: [`The published officials were ${joinList(listed)}.`],
    figures: unique.flatMap((official) => {
      const src = safeImageUrl(official.imageUrl);
      if (!src) return [];
      return [
        {
          src,
          alt: `${official.name}, ${official.role}`,
          caption: `${official.name} — ${official.role}`,
          href: safeImageUrl(official.profileUrl) || undefined,
        },
      ];
    }),
    table: {
      caption: 'Competition officials',
      headers: ['Role', 'Name'],
      rows: unique.map((official) => [official.role, official.name]),
    },
  };
}

function namedPortrait(row: BlogPlace, role: string): BlogFigure[] {
  const src = safeImageUrl(row.imageUrl);
  if (!src) return [];
  return [{ src, alt: `${row.name}, ${role}`, caption: who(row), href: safeImageUrl(row.profileUrl) || undefined }];
}

function classificationSection(
  heading: string,
  id: string,
  rows: BlogPlace[],
  href: string,
  noun: string,
): BlogSection | null {
  if (rows.length === 0) return null;
  const winner = rows[0];
  const sameSentence = `${who(winner)} won the ${noun} classification with a total of ${winner.scoreLabel}.`;
  const rest = rows.slice(1, 3);
  const follow = rest.length
    ? ` ${rest
        .map((row) => {
          const place = RANK_WORDS[row.place] ?? `in position ${row.place}`;
          return `${who(row)} finished ${place} with ${row.scoreLabel}`;
        })
        .join('. ')}.`
    : '';
  return {
    id,
    heading,
    paragraphs: [
      `${sameSentence}${follow}`,
      href
        ? `The ${noun} classification is published with the official results: ${href}.`
        : `The ${noun} classification is published with the official results.`,
    ],
    figures: portraitFigures(rows, noun),
    table: rankingTable(`${heading} at this competition`, 'Pilot', rows.slice(0, 8), true),
  };
}

function teamSection(facts: CompetitionBlogFacts): BlogSection | null {
  if (facts.teamRanking.length === 0) return null;
  const winner = facts.teamRanking[0];
  const scoring = facts.scoring;
  const how =
    scoring && scoring.teamScoringPilots > 0 && scoring.teamSize > 0
      ? ` Team totals used the best ${scoring.teamScoringPilots} of ${scoring.teamSize} pilots.`
      : '';
  return {
    id: 'teams',
    heading: 'Team results',
    paragraphs: [
      `${who(winner)} won the team classification with a total of ${winner.scoreLabel}.${how}`,
      facts.teamCount > 1
        ? `${facts.teamCount} teams were scored. The team classification is published with the official results: ${facts.teamsUrl}.`
        : `The team classification is published with the official results: ${facts.teamsUrl}.`,
    ],
    figures: portraitFigures(facts.teamRanking, 'team'),
    table: rankingTable('Team classification', 'Team', facts.teamRanking.slice(0, 8), false),
  };
}

function fieldSection(facts: CompetitionBlogFacts): BlogSection | null {
  if (facts.pilotCount <= 0 && facts.countries.length === 0) return null;
  const paragraphs: string[] = [];
  if (facts.pilotCount > 0 && facts.countries.length > 0) {
    const top = facts.countries.slice(0, 5).map((country) => `${country.name} (${country.pilotCount})`);
    paragraphs.push(
      `${facts.pilotCount} ${plural(facts.pilotCount, 'pilot')} from ${facts.countries.length} ${plural(facts.countries.length, 'country')} competed. The largest groups were ${joinList(top)}.`,
    );
  } else if (facts.pilotCount > 0) {
    paragraphs.push(`${facts.pilotCount} ${plural(facts.pilotCount, 'pilot')} competed.`);
  }
  if (facts.countries.length > 5) {
    paragraphs.push(`Pilots represented ${joinList(facts.countries.map((country) => country.name))}.`);
  }
  if (paragraphs.length === 0) return null;
  return { id: 'field', heading: 'Who competed', paragraphs };
}

function roundsSection(rounds: BlogRound[]): BlogSection | null {
  if (rounds.length === 0) return null;
  const withAverage = rounds.filter((round) => round.averageLabel);
  const tightest = [...withAverage].sort((a, b) => parseCm(a.averageLabel) - parseCm(b.averageLabel))[0];
  const busiest = [...rounds].sort((a, b) => b.bullseyes - a.bullseyes)[0];
  const paragraphs = [
    `${rounds.length} official ${plural(rounds.length, 'round')} counted. The average is the mean landing distance in that round, in centimetres.`,
  ];
  if (tightest) {
    paragraphs.push(`${tightest.label} was the tightest round, with an average of ${tightest.averageLabel}.`);
  }
  if (busiest && busiest.bullseyes > 0) {
    paragraphs.push(
      `${busiest.label} produced the most bullseyes, ${busiest.bullseyes} ${plural(busiest.bullseyes, 'landing')} on the centre.`,
    );
  }
  return {
    id: 'rounds',
    heading: 'Round by round',
    paragraphs,
    table: {
      caption: 'Official rounds',
      headers: ['Round', 'When', 'Average', 'Bullseyes'],
      rows: rounds.map((round) => [
        round.label,
        round.dateLabel || '—',
        round.averageLabel || '—',
        String(round.bullseyes),
      ]),
    },
  };
}

function scoringSection(name: string, scoring: BlogScoring | null): BlogSection | null {
  if (!scoring) return null;
  const paragraphs = [
    `${name} scored each landing as the distance from the centre of the target, in centimetres. A lower score is a better landing. The maximum score recorded on a round was ${cmLabel(scoring.maximumScoreCm)}.`,
  ];
  if (scoring.targetDiameterCm > 0) {
    paragraphs.push(`The target was ${cmLabel(scoring.targetDiameterCm)} across.`);
  }
  if (scoring.discardWorstRounds > 0) {
    const dropped =
      scoring.discardWorstRounds === 1
        ? 'each pilot’s worst score was discarded'
        : `each pilot’s worst ${scoring.discardWorstRounds} scores were discarded`;
    paragraphs.push(
      `After ${scoring.discardAfterRounds} official ${plural(scoring.discardAfterRounds, 'round')}, ${dropped}. A discarded score still appears on that round’s sheet and is left out of the total.`,
    );
  } else {
    paragraphs.push('Every official round counted toward the total. No scores were discarded.');
  }
  return { id: 'scoring', heading: 'How the result was calculated', paragraphs };
}

function copySection(id: string, heading: string, paragraphs: string[]): BlogSection | null {
  if (paragraphs.length === 0) return null;
  return { id, heading, paragraphs };
}

function partnersSection(name: string, label: string, names: string[]): BlogSection | null {
  if (names.length === 0) return null;
  const heading = label.trim() || 'Partners';
  return {
    id: 'partners',
    heading,
    paragraphs: [finishSentence(`${heading} of ${name}: ${joinList(names)}`)],
  };
}

function resultsSection(name: string, resultsUrl: string): BlogSection {
  return {
    id: 'results',
    heading: 'Official results',
    paragraphs: [
      `Round scores, the complete pilot list, team standings and the rest of the ${name} classification are on the official results page at ${resultsUrl}.`,
    ],
  };
}

function buildFaqs(
  facts: CompetitionBlogFacts,
  winner: BlogPlace | null,
  place: string,
  dates: string,
): BlogFaq[] {
  const name = facts.name.trim();
  const faqs: BlogFaq[] = [];
  if (winner) {
    faqs.push({
      question: `Who won ${name}?`,
      answer: `${who(winner)} won ${name} with a total of ${winner.scoreLabel}.`,
    });
  }
  if (place) {
    faqs.push({
      question: `Where was ${name} held?`,
      answer: facts.organizer.trim()
        ? `${facts.organizer.trim()} held ${name} at ${place}.`
        : `${name} was held at ${place}.`,
    });
  }
  if (dates) {
    faqs.push({
      question: `When was ${name}?`,
      answer: `${name} took place on ${dates}.`,
    });
  }
  if (facts.pilotCount > 0) {
    faqs.push({
      question: `How many pilots competed at ${name}?`,
      answer: `${facts.pilotCount} ${plural(facts.pilotCount, 'pilot')} competed${
        facts.officialRoundCount > 0
          ? ` across ${facts.officialRoundCount} official ${plural(facts.officialRoundCount, 'round')}`
          : ''
      }.`,
    });
  }
  return faqs;
}

function rankingTable(caption: string, nameHeader: string, rows: BlogPlace[], showBullseyes: boolean): BlogTable {
  const country = rows.some((row) => row.country);
  const rounds = rows.some((row) => row.roundsFlown > 0);
  const bullseyes = showBullseyes && rows.some((row) => row.bullseyes > 0);
  const headers = ['Rank', nameHeader];
  if (country) headers.push('Country');
  if (rounds) headers.push('Rounds');
  if (bullseyes) headers.push('Bullseyes');
  headers.push('Total');
  return {
    caption,
    headers,
    rows: rows.map((row) => {
      const cells = [String(row.place), row.name];
      if (country) cells.push(row.country || '—');
      if (rounds) cells.push(String(row.roundsFlown));
      if (bullseyes) cells.push(String(row.bullseyes));
      cells.push(row.scoreLabel);
      return cells;
    }),
  };
}

function renderFigures(figures: BlogFigure[]): string {
  return figures
    .flatMap((figure) => {
      const src = safeImageUrl(figure.src);
      if (!src) return [];
      const figureHtml = `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(figure.alt)}" /><figcaption>${escapeHtml(figure.caption)}</figcaption></figure>`;
      const href = safeImageUrl(figure.href);
      return [href ? `<a href="${escapeHtml(href)}">${figureHtml}</a>` : figureHtml];
    })
    .join('\n');
}

function safeImageUrl(url: string | null | undefined): string {
  const value = url?.trim() ?? '';
  return /^https?:\/\//i.test(value) ? value : '';
}

function renderTable(table: BlogTable): string {
  const head = table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const body = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('\n');
  return `<table>\n<caption>${escapeHtml(table.caption)}</caption>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
}

function who(row: BlogPlace): string {
  return row.country ? `${row.name} (${row.country})` : row.name;
}

function scaleSentence(pilotCount: number, teamCount: number, officialRoundCount: number): string {
  const parts: string[] = [];
  if (pilotCount > 0) parts.push(`${pilotCount} ${plural(pilotCount, 'pilot')}`);
  if (teamCount > 0) parts.push(`${teamCount} ${plural(teamCount, 'team')}`);
  if (parts.length === 0 && officialRoundCount <= 0) return '';
  const field = parts.length ? ` ${joinList(parts)} competed` : '';
  const rounds =
    officialRoundCount > 0
      ? `${field ? ' across' : ''} ${officialRoundCount} official ${plural(officialRoundCount, 'round')}`
      : '';
  return `${field}${rounds}.`.replace(/^\./, '');
}

function podiumSentence(podium: BlogPlace[]): string | null {
  if (podium.length === 0) return null;
  return podium
    .map((row) => {
      const place = RANK_WORDS[row.place] ?? `in position ${row.place}`;
      return `${who(row)} finished ${place} with a total of ${row.scoreLabel}.`;
    })
    .join(' ');
}

function finishSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function plural(count: number, word: string): string {
  if (count === 1) return word;
  if (word === 'country') return 'countries';
  return `${word}s`;
}

function cmLabel(cm: number): string {
  const rounded = Math.round(cm * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} cm`;
}

function parseCm(label: string): number {
  const value = Number.parseFloat(label);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
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
