/**
 * Sub-application links that exist in the deployed stack.
 * Paths match docker/nginx path prefixes — do not invent apps.
 */

export type AeroJudgeAppLink = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  href: string;
  requiresAuth: boolean;
};

/**
 * Resolve an app path for local vs production.
 * Local Vite apps run on separate ports; production uses path prefixes.
 */
function appHref(productionPath: string, localPort: number): string {
  if (import.meta.env.DEV) {
    return `http://localhost:${localPort}/`;
  }
  return productionPath;
}

export const aeroJudgeApps: AeroJudgeAppLink[] = [
  {
    id: 'admin',
    name: 'AeroJudge Admin',
    shortName: 'Admin',
    description: 'Manage organizations, competitions, pilots, teams, rankings and reports.',
    href: appHref('/admin/', 3000),
    requiresAuth: true,
  },
  {
    id: 'judge',
    name: 'AeroJudge Scoring',
    shortName: 'Scoring',
    description: 'Fast touch scoring for judges and scorers — including offline queue resilience.',
    href: appHref('/judge/', 3001),
    requiresAuth: true,
  },
  {
    id: 'events',
    name: 'AeroJudge Events',
    shortName: 'Events',
    description: 'Browse competitions — live standings, registration, and past events.',
    href: appHref('/events/', 3003),
    requiresAuth: false,
  },
  {
    id: 'display',
    name: 'AeroJudge Display',
    shortName: 'Display',
    description: 'Full-screen venue leaderboards for LED walls, TVs and projectors.',
    href: appHref('/display/', 3002),
    requiresAuth: false,
  },
];
