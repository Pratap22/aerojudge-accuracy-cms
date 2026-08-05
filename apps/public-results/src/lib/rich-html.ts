import DOMPurify from 'dompurify';
import { isEmptyHtml } from '@npha/shared';

/** Sanitize brochure HTML for safe public rendering. */
export function sanitizePublicHtml(html: string | null | undefined): string {
  if (isEmptyHtml(html) || !html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'blockquote',
      'a',
      'hr',
      'span',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'name'],
  });
}

export function osmEmbedUrl(lat: number, lng: number, zoom: number): string {
  const delta = 0.02 * Math.pow(2, 13 - zoom);
  const minLon = lng - delta;
  const minLat = lat - delta;
  const maxLon = lng + delta;
  const maxLat = lat + delta;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function osmBrowseUrl(lat: number, lng: number, zoom: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}
