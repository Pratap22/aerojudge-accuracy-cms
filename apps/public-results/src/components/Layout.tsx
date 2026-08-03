import type { ReactNode } from 'react';
import { Navigation } from './Navigation';
import { CompetitionSeo } from './Seo';

interface LayoutProps {
  children: ReactNode;
  /** Skip competition-based document SEO (list page uses its own). */
  seo?: 'competition' | 'none';
}

export function Layout({ children, seo = 'competition' }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#050d1a] text-white">
      {seo === 'competition' ? <CompetitionSeo /> : null}
      <Navigation />
      <main className="pt-20">{children}</main>
    </div>
  );
}
