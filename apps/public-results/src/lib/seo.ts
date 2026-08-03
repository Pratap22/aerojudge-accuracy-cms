import { useEffect } from 'react';

type DocumentSeoProps = {
  title: string;
  description?: string;
  /** Absolute canonical URL for this page */
  url?: string;
  image?: string;
  noIndex?: boolean;
};

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Client-side document title + Open Graph tags for browser tabs and some crawlers.
 * Social previews for /results/* are primarily served by nginx+API SEO HTML for bots.
 */
export function useDocumentSeo({ title, description, url, image, noIndex }: DocumentSeoProps) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    if (description) {
      upsertMeta('name', 'description', description);
      upsertMeta('property', 'og:description', description);
      upsertMeta('name', 'twitter:description', description);
    }

    upsertMeta('property', 'og:title', title);
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', 'AeroJudge');
    upsertMeta('name', 'twitter:card', 'summary_large_image');

    if (url) {
      upsertMeta('property', 'og:url', url);
      upsertLink('canonical', url);
    }
    if (image) {
      upsertMeta('property', 'og:image', image);
      upsertMeta('name', 'twitter:image', image);
    }
    if (noIndex) {
      upsertMeta('name', 'robots', 'noindex, nofollow');
    }

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, url, image, noIndex]);
}

export function defaultShareImageUrl(): string {
  return `${window.location.origin}/og-default.svg`;
}
