import type { ReactNode } from 'react';
import { Navigation } from './Navigation';
import { CompetitionSeo } from './Seo';
import { useRoundsStatus } from '../hooks/useCompetition';

interface LayoutProps {
  children: ReactNode;
  /** Skip competition-based document SEO (list page uses its own). */
  seo?: 'competition' | 'none';
}

export function Layout({ children, seo = 'competition' }: LayoutProps) {
  const { pausedRound } = useRoundsStatus();
  const showPause = seo === 'competition' && pausedRound;

  return (
    <div className="flex min-h-screen flex-col bg-[#050d1a] text-white">
      {seo === 'competition' ? <CompetitionSeo /> : null}
      <Navigation />
      <main className="flex-1 pt-20">
        {showPause ? (
          <div className="border-b border-amber-400/30 bg-amber-500/15 px-6 py-2.5 text-center text-amber-100">
            <p className="text-sm font-medium">Round {pausedRound.number} is paused</p>
            {pausedRound.pauseReason ? (
              <p className="mt-1 whitespace-pre-wrap text-base text-white">{pausedRound.pauseReason}</p>
            ) : null}
          </div>
        ) : null}
        {children}
      </main>
      <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-500">
        <p>
          Powered by <span className="font-medium tracking-wide text-slate-400">AeroJudge</span>
        </p>
      </footer>
    </div>
  );
}
