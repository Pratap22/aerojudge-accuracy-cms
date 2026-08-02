export type CompetitionRole = {
  id: string;
  title: string;
  summary: string;
  can: string[];
  cannot?: string[];
};

/**
 * Role copy aligned with SYSTEM_ORG_ROLE_DEFINITIONS in @npha/shared.
 * Written for organizers — not RBAC jargon.
 */
export const competitionRoles: CompetitionRole[] = [
  {
    id: 'chief-judge',
    title: 'Chief Judge',
    summary: 'Owns scoring integrity from live rounds through official results.',
    can: [
      'Oversee competition scoring',
      'Review and confirm scores',
      'Monitor rankings as rounds progress',
      'Approve results when dual approval is enabled',
      'Access reports and audit history',
      'Update weather and scoring-related settings where permitted',
    ],
  },
  {
    id: 'meet-director',
    title: 'Meet Director',
    summary: 'Runs the competition operation from setup to publication.',
    can: [
      'Configure the competition',
      'Manage pilots, teams and officials',
      'Open and close rounds',
      'Coordinate publication and printing',
      'Access reports and operational settings',
      'Control display and announcements where permitted',
    ],
  },
  {
    id: 'scorer',
    title: 'Scorer',
    summary: 'Enters and confirms scores without full administrative control.',
    can: [
      'Enter and confirm scores',
      'Manage pilots and teams as needed for scoring',
      'View live and team rankings',
      'Generate permitted print reports',
    ],
    cannot: ['Administrative competition deletion or organization-wide settings'],
  },
  {
    id: 'judge',
    title: 'Judge',
    summary: 'Records scores from the judging position.',
    can: [
      'Enter scores on assigned rounds',
      'Help manage round start and close where permitted',
      'See relevant pilot and round information',
    ],
  },
  {
    id: 'announcer',
    title: 'Announcer',
    summary: 'Follows the live competition for commentary.',
    can: [
      'Access announcement capabilities where configured',
      'Follow live competition progress with organization access',
    ],
    cannot: [
      'Modify scores unless separately granted scoring permissions',
      'A dedicated announcer screen UI is on the roadmap',
    ],
  },
  {
    id: 'display-operator',
    title: 'Display Operator',
    summary: 'Controls what the venue audience sees.',
    can: [
      'Control LED and venue display layouts',
      'Switch leaderboard, current pilot and team views',
      'Show sponsor display modes',
      'Generate permitted print outputs',
    ],
    cannot: ['Modify competition scores'],
  },
];

export const additionalRoles = [
  'Launch Marshal',
  'Goal Marshal',
  'Registration Officer',
  'Viewer',
] as const;
