import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LowerThird } from '../components/LowerThird';
import { ScoreBug } from '../components/ScoreBug';
import { Countdown } from '../components/Countdown';
import { WindWidget } from '../components/WindWidget';
import { SponsorStrip } from '../components/SponsorStrip';
import { RankChangeToastList } from '../components/RankChangeToast';
import { useOverlayData } from '../hooks/useOverlayData';
import { getEnabledWidgets } from '../lib/utils';

export function OverlayPage() {
  const { competitionId } = useParams<{ competitionId: string }>();
  const {
    competition,
    currentPilot,
    latestScoreCm,
    isBullseye,
    resultLabel,
    hasLastScore,
    wind,
    rankToasts,
    isLoading,
  } = useOverlayData();
  const widgets = useMemo(() => getEnabledWidgets(), []);

  if (isLoading) {
    return null;
  }

  if (!competition) {
    return (
      <div className="pointer-events-auto flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] p-8 text-center text-white">
        <p className="text-lg font-semibold text-red-400">Competition not found</p>
        <p className="mt-2 font-mono text-sm text-white/40">id: {competitionId}</p>
        <Link to="/" className="mt-6 text-sky-400 underline">
          Back to competitions
        </Link>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0">
      <LowerThird
        pilot={currentPilot}
        visible={widgets.has('lowerthird')}
        fromLastScore={hasLastScore}
      />
      <ScoreBug
        pilot={currentPilot}
        liveScoreCm={latestScoreCm}
        isBullseye={isBullseye}
        resultLabel={resultLabel}
        hasLastScore={hasLastScore}
        visible={widgets.has('scorebug')}
      />
      <Countdown visible={widgets.has('countdown')} />
      <WindWidget wind={wind} visible={widgets.has('wind')} />
      <SponsorStrip visible={widgets.has('sponsors')} />
      <RankChangeToastList toasts={rankToasts} />
    </div>
  );
}
