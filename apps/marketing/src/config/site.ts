/**
 * Site-wide marketing configuration.
 * Override contact via VITE_CONTACT_EMAIL / VITE_SITE_URL at build time.
 */

const envEmail = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;
const envSiteUrl = import.meta.env.VITE_SITE_URL as string | undefined;

export const siteConfig = {
  productName: 'AeroJudge',
  companyName: 'Nepalabs',
  tagline: 'Professional Competition Management for Air Sports',
  discipline: 'Paragliding Accuracy',
  siteUrl: (envSiteUrl || 'https://aerojudge.nepalabs.com').replace(/\/$/, ''),
  contactEmail: envEmail || 'hello@nepalabs.com',
  githubUrl: 'https://github.com/Pratap22/aerojudge-accuracy-cms',
  docsUrl: 'https://github.com/Pratap22/aerojudge-accuracy-cms/tree/main/docs',
  seo: {
    title: 'AeroJudge | Air Sports Competition Management',
    description:
      'AeroJudge by Nepalabs helps organizers manage Paragliding Accuracy competitions with live scoring, team rankings, displays, reports and official result workflows.',
  },
} as const;

export function mailtoContact(subject: string, body?: string): string {
  const params = new URLSearchParams({ subject });
  if (body) params.set('body', body);
  return `mailto:${siteConfig.contactEmail}?${params.toString()}`;
}
