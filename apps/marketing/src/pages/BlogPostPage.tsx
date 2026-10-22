import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchBlogPost, type BlogArticle, type BlogSection } from '@/lib/api';
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
    article?.coverImage || undefined,
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

      <div className="mt-8 space-y-10 text-sm leading-relaxed text-muted-foreground">
        {article.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}

        {article.sections.map((section) => (
          <SectionBlock key={section.id} section={section} />
        ))}

        {article.faqs.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-bold text-navy">Common questions</h2>
            <dl className="mt-4 space-y-4">
              {article.faqs.map((faq) => (
                <div key={faq.question}>
                  <dt className="font-semibold text-navy">{faq.question}</dt>
                  <dd className="mt-1">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {article.related.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-bold text-navy">More competition stories</h2>
            <ul className="mt-4 space-y-2">
              {article.related.map((link) => (
                <li key={link.slug}>
                  <Link
                    to={`/blog/${encodeURIComponent(link.slug)}`}
                    className="font-medium text-navy underline-offset-2 hover:underline"
                  >
                    {link.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p>
          <Link to="/blog" className="font-medium text-navy underline-offset-2 hover:underline">
            ← All stories
          </Link>
        </p>
      </div>
    </article>
  );
}

function SectionBlock({ section }: { section: BlogSection }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-bold text-navy">{section.heading}</h2>
      <div className="mt-3 space-y-3">
        {section.paragraphs.map((paragraph) => (
          <p key={paragraph}>
            <LinkedText text={paragraph} />
          </p>
        ))}
      </div>
      {section.figures && section.figures.length > 0 && (
        <ul
          className={
            section.id === 'photos'
              ? 'mt-4 grid gap-3 sm:grid-cols-2'
              : 'mt-4 grid gap-3 sm:grid-cols-3'
          }
        >
          {section.figures.map((figure) => (
            <li key={`${figure.src}-${figure.caption}`} className="overflow-hidden rounded-xl border border-border bg-white">
              <img
                src={figure.src}
                alt={figure.alt}
                className={
                  section.id === 'photos'
                    ? 'aspect-[4/3] w-full object-cover'
                    : 'aspect-square w-full object-cover'
                }
              />
              <p className="px-3 py-2 text-xs font-medium text-navy">{figure.caption}</p>
            </li>
          ))}
        </ul>
      )}
      {section.table && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <caption className="sr-only">{section.table.caption}</caption>
            <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-navy">
              <tr>
                {section.table.headers.map((header) => (
                  <th key={header} className="px-3 py-2 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row) => (
                <tr key={row.join('|')} className="border-t border-border">
                  {row.map((cell, index) => (
                    <td
                      key={`${index}-${cell}`}
                      className={index === 1 ? 'px-3 py-2 font-medium text-navy' : 'px-3 py-2'}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LinkedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (!part.startsWith('http')) return <span key={`${index}-text`}>{part}</span>;
        const url = part.replace(/[.,;:!?]+$/, '');
        const tail = part.slice(url.length);
        return (
          <span key={`${index}-link`}>
            <a href={url} className="font-medium text-navy underline-offset-2 hover:underline break-all">
              {url}
            </a>
            {tail}
          </span>
        );
      })}
    </>
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
