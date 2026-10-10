import type { ReactNode } from 'react';
import { AeroJudgeLogo } from '@aero-judge/ui';
import { Navigation } from './Navigation';
import { CompetitionSeo } from './Seo';
import { officialDisplayNumber } from '@aero-judge/utils';
import { useRoundsStatus } from '../hooks/useCompetition';

interface LayoutProps {
  children: ReactNode;
  /** Skip competition-based document SEO (list page uses its own). */
  seo?: 'competition' | 'none';
}

export function Layout({ children, seo = 'competition' }: LayoutProps) {
  const { pausedRound, data: roundsStatus } = useRoundsStatus();
  const pausedRounds = roundsStatus?.rounds ?? [];
  const showPause = seo === 'competition' && pausedRound;

  return (
    <div className="flex min-h-screen flex-col bg-[#050d1a] text-white">
      {seo === 'competition' ? <CompetitionSeo /> : null}
      <Navigation />
      <main className="flex-1 pt-20">
        {showPause ? (
          <div className="border-b border-amber-400/30 bg-amber-500/15 px-6 py-2.5 text-center text-amber-100">
            <p className="text-sm font-medium">
              {pausedRound.type === 'PRACTICE'
                ? 'Practice round'
                : `Round ${
                    officialDisplayNumber(
                      pausedRounds,
                      pausedRound.number,
                    ) ?? pausedRound.number
                  }`}{' '}
              is paused
            </p>
            {pausedRound.pauseReason ? (
              <p className="mt-1 whitespace-pre-wrap text-base text-white">{pausedRound.pauseReason}</p>
            ) : null}
          </div>
        ) : null}
        {children}
      </main>
      <footer className="flex justify-center border-t border-white/10 py-8">
        <AeroJudgeLogo className="h-12 w-auto" />
      </footer>
    </div>
  );
}
