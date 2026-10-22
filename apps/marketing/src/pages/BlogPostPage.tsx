import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchBlogPost, type BlogArticle } from '@/lib/api';
import { usePageMeta } from '@/lib/page-meta';

export default function BlogPostPage() {
  const { slug = '' } = useParams();
  const [article, setArticle] = useState<BlogArticle | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setArticle(null);
    setError(false);
    fetchBlogPost(slug)
      .then((post) => {
        if (!cancelled) setArticle(post);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  usePageMeta(
    article ? `${article.title} · AeroJudge` : 'Competition story · AeroJudge',
    article?.description ?? 'A completed paragliding accuracy competition on AeroJudge.',
  );

  if (error) {
    return (
      <article className="content-width section-pad max-w-3xl">
        <p className="eyebrow">Stories</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-navy">Story not published</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          This competition is not finished, or its results are not public.
        </p>
        <p className="mt-6">
          <Link to="/blog" className="font-medium text-navy underline-offset-2 hover:underline">
            ← All stories
          </Link>
        </p>
      </article>
    );
  }

  if (!article) {
    return (
      <article className="content-width section-pad max-w-3xl">
        <p className="text-sm text-muted-foreground">Loading story…</p>
      </article>
    );
  }

  const place = [article.venue, article.country].filter(Boolean).join(', ');

  return (
    <article className="content-width section-pad max-w-3xl">
      <p className="eyebrow">Stories</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-navy">{article.title}</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        <time dateTime={article.publishedAt}>{formatStoryDate(article.startDate, article.endDate)}</time>
        {place ? ` · ${place}` : ''}
        {article.organizer ? ` · ${article.organizer}` : ''}
      </p>

      <div className="prose-marketing mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        {article.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}

        {article.podium.length > 0 && (
          <ol className="list-decimal space-y-2 pl-5 text-navy">
            {article.podium.map((row) => (
              <li key={`${row.place}-${row.name}`}>
                <span className="font-semibold">{row.name}</span>
                {row.country ? <span className="text-muted-foreground"> ({row.country})</span> : null}
                <span className="text-muted-foreground"> — {row.scoreLabel}</span>
              </li>
            ))}
          </ol>
        )}

        <p>
          <a
            className="font-medium text-navy underline-offset-2 hover:underline"
            href={article.resultsUrl}
          >
            Official results
          </a>
        </p>
        <p>
          <Link to="/blog" className="font-medium text-navy underline-offset-2 hover:underline">
            ← All stories
          </Link>
        </p>
      </div>
    </article>
  );
}

function formatStoryDate(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
  if (s.toDateString() === e.toDateString()) return s.toLocaleDateString(undefined, opts);
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}
