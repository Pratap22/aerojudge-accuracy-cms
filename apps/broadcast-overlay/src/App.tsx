import { useMemo } from 'react';
import { LowerThird } from './components/LowerThird';
import { ScoreBug } from './components/ScoreBug';
import { Countdown } from './components/Countdown';
import { WindWidget } from './components/WindWidget';
import { SponsorStrip } from './components/SponsorStrip';
import { RankChangeToastList } from './components/RankChangeToast';
import { useOverlayData } from './hooks/useOverlayData';
import { getEnabledWidgets } from './lib/utils';

function App() {
  const { currentPilot, latestScoreCm, isBullseye, wind, rankToasts } = useOverlayData();
  const widgets = useMemo(() => getEnabledWidgets(), []);

  return (
    <div className="pointer-events-none fixed inset-0">
      <LowerThird pilot={currentPilot} visible={widgets.has('lowerthird')} />
      <ScoreBug
        pilot={currentPilot}
        liveScoreCm={latestScoreCm}
        isBullseye={isBullseye}
        visible={widgets.has('scorebug')}
      />
      <Countdown visible={widgets.has('countdown')} />
      <WindWidget wind={wind} visible={widgets.has('wind')} />
      <SponsorStrip visible={widgets.has('sponsors')} />
      <RankChangeToastList toasts={rankToasts} />
    </div>
  );
}

export default App;
