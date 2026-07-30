import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { DisplayControls } from './components/DisplayControls';
import { LayoutRouter } from './layouts/LayoutRouter';
import { CurrentPilotLayout } from './layouts/CurrentPilotLayout';
import { Top10Layout } from './layouts/Top10Layout';
import { TopWomenLayout } from './layouts/TopWomenLayout';
import { TopTeamsLayout } from './layouts/TopTeamsLayout';
import { CountryLayout } from './layouts/CountryLayout';
import { NextPilotsLayout } from './layouts/NextPilotsLayout';
import { SponsorsLayout } from './layouts/SponsorsLayout';
import { useCompetition, useResults, toLeaderboardEntries } from './hooks/useCompetition';
import { useDisplaySocket } from './hooks/useDisplaySocket';
import { AUTO_LAYOUT_SEQUENCE, type DisplayLayoutType } from './lib/types';
import { getAutoInterval, getLayoutFromQuery, isKioskMode } from './lib/utils';

function App() {
  const queryLayout = getLayoutFromQuery() as DisplayLayoutType;
  const [layout, setLayout] = useState<DisplayLayoutType>(queryLayout);
  const [autoIndex, setAutoIndex] = useState(0);
  const [kioskMode, setKioskMode] = useState(isKioskMode());

  const { data: competition, isLoading: compLoading, error: compError } = useCompetition();
  const { data: overallResults, invalidate: refreshOverall } = useResults('OVERALL');
  const { data: womenResults } = useResults('WOMEN');
  const { data: teamResults } = useResults('TEAM');
  const { data: countryResults } = useResults('COUNTRY');

  const socketState = useDisplaySocket(competition?.id, refreshOverall);

  const effectiveLayout = socketState.layoutOverride ?? layout;
  const activeLayout: DisplayLayoutType =
    effectiveLayout === 'auto' ? AUTO_LAYOUT_SEQUENCE[autoIndex] : effectiveLayout;

  useEffect(() => {
    document.body.classList.toggle('kiosk-mode', kioskMode);
    return () => document.body.classList.remove('kiosk-mode');
  }, [kioskMode]);

  useEffect(() => {
    if (effectiveLayout !== 'auto') return;
    const interval = getAutoInterval();
    const timer = setInterval(() => {
      setAutoIndex((i) => (i + 1) % AUTO_LAYOUT_SEQUENCE.length);
    }, interval * 1000);
    return () => clearInterval(timer);
  }, [effectiveLayout]);

  const overallEntries = useMemo(() => toLeaderboardEntries(overallResults), [overallResults]);
  const womenEntries = useMemo(() => toLeaderboardEntries(womenResults), [womenResults]);
  const teamEntries = useMemo(() => toLeaderboardEntries(teamResults), [teamResults]);
  const countryEntries = useMemo(() => toLeaderboardEntries(countryResults), [countryResults]);

  const currentPilot = useMemo(() => {
    if (!overallResults?.rankings.length) return null;
    if (socketState.currentPilotId) {
      const found = overallResults.rankings.find(
        (r) => r.id === socketState.currentPilotId || r.pilotId === socketState.currentPilotId,
      );
      if (found) return found;
    }
    return overallResults.rankings[0] ?? null;
  }, [overallResults, socketState.currentPilotId]);

  const onDeckQueue = useMemo(() => {
    if (!overallResults?.rankings.length || !currentPilot) {
      return overallResults?.rankings.slice(1, 8) ?? [];
    }
    const idx = overallResults.rankings.findIndex(
      (r) => r.id === currentPilot.id || r.pilotId === currentPilot.pilotId,
    );
    if (idx === -1) return overallResults.rankings.slice(1, 8);
    return overallResults.rankings.slice(idx + 1, idx + 8);
  }, [overallResults, currentPilot]);

  const handleLayoutChange = useCallback((newLayout: DisplayLayoutType) => {
    setLayout(newLayout);
    if (newLayout !== 'auto') {
      setAutoIndex(0);
    }
    const url = new URL(window.location.href);
    url.searchParams.set('layout', newLayout);
    window.history.replaceState({}, '', url);
  }, []);

  if (compLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-broadcast-navy">
        <Loader2 className="h-12 w-12 animate-spin text-sky-400" />
      </div>
    );
  }

  if (compError || !competition) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-broadcast-navy p-8 text-center">
        <p className="font-display text-4xl text-red-400">Connection Error</p>
        <p className="mt-4 text-sky-300">Unable to load competition data. Check API connection.</p>
      </div>
    );
  }

  const renderLayout = () => {
    switch (activeLayout) {
      case 'current':
        return (
          <CurrentPilotLayout
            pilot={currentPilot}
            competitionName={competition.name}
            liveScoreCm={socketState.latestScore?.scoreCm}
            isBullseye={socketState.latestScore?.isBullseye}
          />
        );
      case 'top10':
        return (
          <Top10Layout
            entries={overallEntries}
            highlightPilotNumber={currentPilot?.pilot.pilotNumber}
          />
        );
      case 'women':
        return <TopWomenLayout entries={womenEntries} />;
      case 'teams':
        return <TopTeamsLayout entries={teamEntries} />;
      case 'country':
        return <CountryLayout entries={countryEntries} />;
      case 'next':
        return <NextPilotsLayout current={currentPilot} queue={onDeckQueue} />;
      case 'sponsors':
        return <SponsorsLayout />;
      default:
        return (
          <CurrentPilotLayout
            pilot={currentPilot}
            competitionName={competition.name}
            liveScoreCm={socketState.latestScore?.scoreCm}
          />
        );
    }
  };

  return (
    <div className="relative h-screen overflow-hidden bg-broadcast-navy scanline-overlay">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-8 py-4"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-sky-400/60">NPHA Accuracy</p>
          <h1 className="font-display text-2xl uppercase tracking-wider text-white">{competition.name}</h1>
        </div>
        {socketState.wind && (
          <div className="rounded-lg border border-sky-500/30 bg-broadcast-navy-mid/80 px-4 py-2 text-right">
            <p className="text-xs uppercase tracking-wider text-sky-400">Wind</p>
            <p className="font-mono text-lg text-white">
              {socketState.wind.speedMs.toFixed(1)} m/s · {Math.round(socketState.wind.directionDeg)}°
            </p>
          </div>
        )}
      </motion.header>

      <main className="h-full pt-20 pb-16">
        <LayoutRouter layoutKey={activeLayout}>{renderLayout()}</LayoutRouter>
      </main>

      <DisplayControls
        layout={effectiveLayout}
        onLayoutChange={handleLayoutChange}
        kioskMode={kioskMode}
        onKioskToggle={() => setKioskMode((k) => !k)}
      />
    </div>
  );
}

export default App;
