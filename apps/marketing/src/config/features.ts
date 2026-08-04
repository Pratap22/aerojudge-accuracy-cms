/**
 * Feature catalog for the marketing site.
 * Only AVAILABLE items are marketed as generally available.
 * PLANNED / BETA must not be presented as shipped.
 */

export type FeatureStatus = 'AVAILABLE' | 'BETA' | 'PLANNED';

export type MarketingFeature = {
  id: string;
  name: string;
  description: string;
  status: FeatureStatus;
  category:
    | 'competition'
    | 'scoring'
    | 'results'
    | 'display'
    | 'organization'
    | 'export';
};

export const features: MarketingFeature[] = [
  {
    id: 'competition-mgmt',
    name: 'Competition Management',
    description: 'Full lifecycle from draft setup through archived official results.',
    status: 'AVAILABLE',
    category: 'competition',
  },
  {
    id: 'pilot-registration',
    name: 'Pilot Registration',
    description: 'Register pilots, import from CSV, and manage competition entries.',
    status: 'AVAILABLE',
    category: 'competition',
  },
  {
    id: 'team-management',
    name: 'Team Management',
    description: 'Configure teams and keep team rankings aligned with rule profiles.',
    status: 'AVAILABLE',
    category: 'competition',
  },
  {
    id: 'rule-profiles',
    name: 'FAI-oriented Rule Profiles',
    description:
      'Scoring profiles based on supported FAI Sporting Code rules, plus national and custom adaptations.',
    status: 'AVAILABLE',
    category: 'scoring',
  },
  {
    id: 'live-scoring',
    name: 'Live Scoring',
    description: 'Touch-optimised score entry with validation and real-time updates.',
    status: 'AVAILABLE',
    category: 'scoring',
  },
  {
    id: 'individual-rankings',
    name: 'Individual Rankings',
    description: 'Automatic individual rankings with configured discards and tie-breaks.',
    status: 'AVAILABLE',
    category: 'scoring',
  },
  {
    id: 'team-rankings',
    name: 'Team Rankings',
    description: 'Team scores calculated from individual results per the configured rule profile.',
    status: 'AVAILABLE',
    category: 'scoring',
  },
  {
    id: 'round-management',
    name: 'Round Management',
    description: 'Open, pause, close and reflight rounds with flight order control.',
    status: 'AVAILABLE',
    category: 'competition',
  },
  {
    id: 'led-display',
    name: 'LED Display',
    description: 'Browser-based full-screen boards for LED walls, TVs and projectors.',
    status: 'AVAILABLE',
    category: 'display',
  },
  {
    id: 'public-results',
    name: 'Public Events',
    description: 'Shareable events for registration, live standings, pilots and archives.',
    status: 'AVAILABLE',
    category: 'results',
  },
  {
    id: 'official-printing',
    name: 'Official Printing',
    description: 'Generate official PDFs for notice boards after review and approval.',
    status: 'AVAILABLE',
    category: 'export',
  },
  {
    id: 'pdf-reports',
    name: 'PDF Reports',
    description: 'Round, overall, team and statistics reports with competition branding.',
    status: 'AVAILABLE',
    category: 'export',
  },
  {
    id: 'csv-export',
    name: 'Excel/CSV Export',
    description: 'Export competition data for offline analysis and federation reporting.',
    status: 'AVAILABLE',
    category: 'export',
  },
  {
    id: 'statistics',
    name: 'Competition Statistics',
    description: 'View competition statistics for officials and public audiences.',
    status: 'AVAILABLE',
    category: 'results',
  },
  {
    id: 'audit',
    name: 'Audit History',
    description: 'Trace score changes, approvals and configuration updates.',
    status: 'AVAILABLE',
    category: 'organization',
  },
  {
    id: 'org-management',
    name: 'Organization Management',
    description: 'Multi-tenant organizations with isolated competitions and officials.',
    status: 'AVAILABLE',
    category: 'organization',
  },
  {
    id: 'rbac',
    name: 'Role-Based Access',
    description: 'Assign Meet Director, Chief Judge, Scorer, Judge, Display Operator and more.',
    status: 'AVAILABLE',
    category: 'organization',
  },
  {
    id: 'branding',
    name: 'Competition Branding',
    description: 'Organization logos, colors and sponsor displays on results and boards.',
    status: 'AVAILABLE',
    category: 'organization',
  },
  {
    id: 'offline',
    name: 'Offline Score Queue',
    description: 'Judge terminals queue scores locally when connectivity drops, then sync.',
    status: 'AVAILABLE',
    category: 'scoring',
  },
  {
    id: 'dual-approval',
    name: 'Dual Approval Workflow',
    description: 'Optional Chief Judge and Meet Director approval before locking official results.',
    status: 'AVAILABLE',
    category: 'scoring',
  },
  {
    id: 'announcer-ui',
    name: 'Dedicated Announcer Screen',
    description: 'Purpose-built commentary UI for current, previous and next pilots.',
    status: 'PLANNED',
    category: 'display',
  },
  {
    id: 'obs-integration',
    name: 'Native OBS Integration',
    description: 'First-class OBS plugin or scene presets beyond browser sources.',
    status: 'PLANNED',
    category: 'display',
  },
];

export const availableFeatures = features.filter((f) => f.status === 'AVAILABLE');

export const plannedFeatures = features.filter((f) => f.status === 'PLANNED');
