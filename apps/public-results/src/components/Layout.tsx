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
    <div className="flex min-h-screen flex-col bg-[#050d1a] text-white">
      {seo === 'competition' ? <CompetitionSeo /> : null}
      <Navigation />
      <main className="flex-1 pt-20">{children}</main>
      <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-500">
        <p>
          Powered by <span className="font-medium tracking-wide text-slate-400">AeroJudge</span>
        </p>
      </footer>
    </div>
  );
}
