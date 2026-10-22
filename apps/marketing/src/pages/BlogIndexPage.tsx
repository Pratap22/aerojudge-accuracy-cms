import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchBlogPosts, type BlogSummary } from '@/lib/api';
import { usePageMeta } from '@/lib/page-meta';

const DESCRIPTION =
  'Stories from completed paragliding accuracy competitions — winners, venues and official results on AeroJudge.';

export default function BlogIndexPage() {
  const [posts, setPosts] = useState<BlogSummary[] | null>(null);
  const [error, setError] = useState(false);
  usePageMeta('Competition stories · AeroJudge', DESCRIPTION);

  useEffect(() => {
    let cancelled = false;
    fetchBlogPosts()
      .then((rows) => {
        if (!cancelled) setPosts(rows);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="content-width section-pad max-w-3xl">
      <p className="eyebrow">Stories</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-navy">Competition stories</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">{DESCRIPTION}</p>

      {posts === null && !error && (
        <p className="mt-10 text-sm text-muted-foreground">Loading stories…</p>
      )}

      {error && (
        <p className="mt-10 text-sm text-muted-foreground">
          Stories will appear here once a completed competition publishes its results.
        </p>
      )}

      {posts && posts.length === 0 && (
        <p className="mt-10 text-sm text-muted-foreground">
          No completed competitions are public yet. A story is added when a competition is finished and its
          results are published.
        </p>
      )}

      {posts && posts.length > 0 && (
        <ul className="mt-10 space-y-4">
          {posts.map((post) => {
            const place = [post.venue, post.country].filter(Boolean).join(' · ');
            return (
              <li key={post.slug}>
                <article className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                  {post.coverImage ? (
                    <Link to={`/blog/${encodeURIComponent(post.slug)}`} className="block">
                      <img src={post.coverImage} alt="" className="aspect-[16/7] w-full object-cover" />
                    </Link>
                  ) : null}
                  <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky">
                    <time dateTime={post.publishedAt}>{formatStoryDate(post.startDate, post.endDate)}</time>
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-navy">
                    <Link to={`/blog/${encodeURIComponent(post.slug)}`} className="hover:text-sky">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {place}
                    {post.organizer ? ` · ${post.organizer}` : ''}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{post.description}</p>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
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
