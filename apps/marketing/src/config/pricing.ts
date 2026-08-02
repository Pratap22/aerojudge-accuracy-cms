/**
 * Pricing configuration — single source of truth for marketing pricing UI.
 * Monetary amounts are intentionally unset until commercial terms are finalized.
 * Maps conceptually to OrganizationPlan (FREE / PROFESSIONAL / ENTERPRISE).
 */

export type PricingInterval = 'month' | 'year' | 'event' | 'custom';

export type PriceDisplay =
  | { kind: 'free' }
  | { kind: 'contact' }
  | { kind: 'coming_soon' }
  | { kind: 'amount'; amount: number; currency: string; interval: PricingInterval };

export type PricingTierId = 'community' | 'pro' | 'enterprise';

export type PricingTier = {
  id: PricingTierId;
  /** Maps to OrganizationPlan where applicable */
  planKey: 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE';
  name: string;
  tagline: string;
  price: PriceDisplay;
  popular?: boolean;
  cta: {
    label: string;
    href: string;
    external?: boolean;
  };
  features: string[];
};

function adminStartHref(): string {
  if (import.meta.env.DEV) return 'http://localhost:3000/login';
  return '/admin/login';
}

function contactHref(subject: string): string {
  const email = import.meta.env.VITE_CONTACT_EMAIL || 'hello@nepalabs.com';
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}

export const pricingConfig = {
  currencyDefault: 'USD',
  billingNote:
    'Commercial pricing will be published here when available. Community remains free for clubs and small events within plan limits.',
  tiers: [
    {
      id: 'community',
      planKey: 'FREE',
      name: 'Community',
      tagline: 'For clubs, training events and small competitions.',
      price: { kind: 'free' },
      cta: {
        label: 'Start Free',
        href: adminStartHref(),
      },
      features: [
        'Core competition management',
        'Pilot & team management',
        'Live scoring & rankings',
        'Basic public results',
        'Role-based access within plan limits',
      ],
    },
    {
      id: 'pro',
      planKey: 'PROFESSIONAL',
      name: 'Pro',
      tagline: 'For professional competition organizers.',
      price: { kind: 'contact' },
      popular: true,
      cta: {
        label: 'Contact Us',
        href: contactHref('AeroJudge Pro inquiry'),
        external: true,
      },
      features: [
        'Everything in Community',
        'Team scoring & advanced rankings',
        'LED / venue display',
        'Official PDF printing & reports',
        'Organization branding',
        'Audit history',
        'Higher competition & user limits',
      ],
    },
    {
      id: 'enterprise',
      planKey: 'ENTERPRISE',
      name: 'Enterprise',
      tagline: 'For federations running multiple competitions.',
      price: { kind: 'contact' },
      cta: {
        label: 'Contact Nepalabs',
        href: contactHref('AeroJudge Enterprise inquiry'),
        external: true,
      },
      features: [
        'Everything in Pro',
        'Multiple competitions at scale',
        'Advanced organization management',
        'Custom branding options',
        'Priority support during events',
        'Custom rule profile assistance',
        'Roadmap input for integrations',
      ],
    },
  ] satisfies PricingTier[],
};

export type PricingFaq = {
  question: string;
  answer: string;
};

export const pricingFaqs: PricingFaq[] = [
  {
    question: 'Can I try AeroJudge before purchasing?',
    answer:
      'Yes. Start on the Community plan to explore competition setup, scoring and results. Contact Nepalabs when you need Pro or Enterprise capacity.',
  },
  {
    question: 'Can AeroJudge be used for a single competition?',
    answer:
      'Yes. Many organizers run one event at a time. Create a competition under your organization, run scoring and publish results — then archive when finished.',
  },
  {
    question: 'Does AeroJudge support team scoring?',
    answer:
      'Yes. Individual scores feed into team calculations according to the competition’s configured rule profile, with transparent team rankings.',
  },
  {
    question: 'Can we use our own competition branding?',
    answer:
      'Yes. Organizations can configure logos, colors and sponsor displays used on public results, displays and printable reports.',
  },
  {
    question: 'Does AeroJudge work with LED displays?',
    answer:
      'Yes. AeroJudge Display runs in a browser and can be shown full-screen on a computer connected to an LED wall, TV, projector or external monitor.',
  },
  {
    question: 'Can we print official results?',
    answer:
      'Yes. After results are reviewed and approved according to your workflow settings, officials can generate branded PDF reports for the notice board.',
  },
  {
    question: 'Can one user belong to multiple organizations?',
    answer:
      'Yes. A person can hold different roles in different organizations — for example Chief Judge in one federation and Announcer in another.',
  },
  {
    question: 'Do you provide support during competitions?',
    answer:
      'Pro and Enterprise customers can arrange support with Nepalabs. Contact us ahead of major events so we can align coverage with your schedule.',
  },
];

export function formatPrice(price: PriceDisplay): string {
  switch (price.kind) {
    case 'free':
      return 'Free';
    case 'contact':
      return 'Contact Us';
    case 'coming_soon':
      return 'Coming Soon';
    case 'amount': {
      const formatted = new Intl.NumberFormat('en', {
        style: 'currency',
        currency: price.currency,
        maximumFractionDigits: 0,
      }).format(price.amount);
      const suffix =
        price.interval === 'custom'
          ? ''
          : price.interval === 'event'
            ? ' / event'
            : ` / ${price.interval}`;
      return `${formatted}${suffix}`;
    }
  }
}
