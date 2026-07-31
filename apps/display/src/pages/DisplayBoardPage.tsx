import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { DisplayControls } from '../components/DisplayControls';
import { LayoutRouter } from '../layouts/LayoutRouter';
import { CurrentPilotLayout } from '../layouts/CurrentPilotLayout';
import { Top10Layout } from '../layouts/Top10Layout';
import { TopWomenLayout } from '../layouts/TopWomenLayout';
import { TopTeamsLayout } from '../layouts/TopTeamsLayout';
import { CountryLayout } from '../layouts/CountryLayout';
import { NextPilotsLayout } from '../layouts/NextPilotsLayout';
import { SponsorsLayout } from '../layouts/SponsorsLayout';
import { useCompetition, useLatestScore, useResults, toLeaderboardEntries } from '../hooks/useCompetition';
import { useDisplaySocket } from '../hooks/useDisplaySocket';
import { AUTO_LAYOUT_SEQUENCE, type DisplayLayoutType, type PublicRankingRow } from '../lib/types';
import { getAutoInterval, getLayoutFromQuery, getScoreHoldSeconds, isKioskMode } from '../lib/utils';

export function DisplayBoardPage() {
  const { competitionId } = useParams<{ competitionId: string }>();
  const queryLayout = getLayoutFromQuery() as DisplayLayoutType;
  const [layout, setLayout] = useState<DisplayLayoutType>(queryLayout);
  const [autoIndex, setAutoIndex] = useState(0);
  const [kioskMode, setKioskMode] = useState(isKioskMode());
  /** When set, force Current until this timestamp (ms). */
  const [scoreFocusUntil, setScoreFocusUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const lastHandledScoreAt = useRef<number | null>(null);

  const { data: competition, isLoading: compLoading, error: compError } = useCompetition();
  const { data: overallResults, invalidate: refreshOverall } = useResults('OVERALL');
  const { data: womenResults } = useResults('WOMEN');
  const { data: teamResults } = useResults('TEAM');
  const { data: countryResults } = useResults('COUNTRY');
  const { data: persistedLatest } = useLatestScore();

  const socketState = useDisplaySocket(competition?.id, refreshOverall);

  useEffect(() => {
    if (!persistedLatest) return;
    socketState.seedLatestScore({
      pilotId: persistedLatest.pilotId,
      pilotNumber: persistedLatest.pilotNumber,
      firstName: persistedLatest.firstName,
      lastName: persistedLatest.lastName,
      countryCode: persistedLatest.countryCode,
      scoreCm: persistedLatest.scoreCm,
      isBullseye: persistedLatest.isBullseye,
      resultLabel: persistedLatest.resultLabel,
      roundNumber: persistedLatest.roundNumber,
      rank: 0,
    });
  }, [persistedLatest, socketState.seedLatestScore]);

  // Pin Current when a judge enters a live score.
  useEffect(() => {
    const at = socketState.lastLiveScoreAt;
    if (!at || at === lastHandledScoreAt.current) return;
    lastHandledScoreAt.current = at;
    setScoreFocusUntil(at + getScoreHoldSeconds() * 1000);
  }, [socketState.lastLiveScoreAt]);

  // Tick while score-focus hold is active so we clear it on time.
  useEffect(() => {
    if (scoreFocusUntil <= 0) return;
    if (Date.now() >= scoreFocusUntil) {
      setScoreFocusUntil(0);
      return;
    }
    setNow(Date.now());
    const tick = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= scoreFocusUntil) {
        setScoreFocusUntil(0);
      }
    }, 500);
    return () => clearInterval(tick);
  }, [scoreFocusUntil]);

  const scoreFocusActive = scoreFocusUntil > 0 && now < scoreFocusUntil;

  const latestScore = socketState.latestScore;
  const lastScorePilotId = latestScore?.pilotId ?? socketState.currentPilotId;

  const baseLayout = socketState.layoutOverride ?? layout;
  const inAuto = !scoreFocusActive && baseLayout === 'auto';
  const controlsLayout: DisplayLayoutType = scoreFocusActive ? 'current' : baseLayout;
  const activeLayout: DisplayLayoutType = scoreFocusActive
    ? 'current'
    : baseLayout === 'auto'
      ? AUTO_LAYOUT_SEQUENCE[autoIndex]
      : baseLayout;

  useEffect(() => {
    document.body.classList.toggle('kiosk-mode', kioskMode);
    return () => document.body.classList.remove('kiosk-mode');
  }, [kioskMode]);

  useEffect(() => {
    if (!inAuto) return;
    const interval = getAutoInterval();
    const timer = setInterval(() => {
      setAutoIndex((i) => (i + 1) % AUTO_LAYOUT_SEQUENCE.length);
    }, interval * 1000);
    return () => clearInterval(timer);
  }, [inAuto]);

  const overallEntries = useMemo(() => toLeaderboardEntries(overallResults), [overallResults]);
  const womenEntries = useMemo(() => toLeaderboardEntries(womenResults), [womenResults]);
  const teamEntries = useMemo(() => toLeaderboardEntries(teamResults), [teamResults]);
  const countryEntries = useMemo(() => toLeaderboardEntries(countryResults), [countryResults]);

  const currentPilot = useMemo((): PublicRankingRow | null => {
    const rankings = overallResults?.rankings ?? [];
    const findInRankings = (id: string | null | undefined) => {
      if (!id) return null;
      return rankings.find((r) => r.id === id || r.pilotId === id) ?? null;
    };

    const fromLastScore = findInRankings(lastScorePilotId);
    if (fromLastScore) return fromLastScore;

    if (latestScore) {
      return {
        id: latestScore.pilotId,
        pilotId: latestScore.pilotId,
        rank: latestScore.rank || 0,
        totalScoreCm: latestScore.scoreCm ?? 0,
        roundsFlown: 1,
        bullseyes: latestScore.isBullseye ? 1 : 0,
        pilot: {
          pilotNumber: latestScore.pilotNumber,
          firstName: latestScore.firstName || persistedLatest?.firstName || '',
          lastName: latestScore.lastName || persistedLatest?.lastName || '',
          nationality: latestScore.countryCode || persistedLatest?.countryCode,
          country: {
            name:
              persistedLatest?.countryName ??
              latestScore.countryCode ??
              '—',
            code: latestScore.countryCode || persistedLatest?.countryCode || 'XX',
          },
        },
      };
    }

    return findInRankings(socketState.currentPilotId) ?? rankings[0] ?? null;
  }, [
    overallResults,
    lastScorePilotId,
    latestScore,
    socketState.currentPilotId,
    persistedLatest,
  ]);

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
    setScoreFocusUntil(0);
    setLayout(newLayout);
    if (newLayout !== 'auto') {
      setAutoIndex(0);
    }
    const url = new URL(window.location.href);
    url.searchParams.set('layout', newLayout);
    window.history.replaceState({}, '', url);
  }, []);

  const lastScoreRound =
    (latestScore?.roundNumber && latestScore.roundNumber > 0
      ? latestScore.roundNumber
      : null) ??
    persistedLatest?.roundNumber ??
    1;
  const lastScoreCm = latestScore?.scoreCm ?? null;
  const lastIsBullseye = latestScore?.isBullseye ?? false;
  const lastResultLabel = latestScore?.resultLabel;
  const hasLastScore = Boolean(latestScore);

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
        <p className="font-display text-4xl text-red-400">Competition not found</p>
        <p className="mt-4 text-sky-300">Check the link and that results are published.</p>
        <p className="mt-2 font-mono text-sm text-sky-500/80">id: {competitionId}</p>
        <Link to="/" className="mt-6 text-sky-400 underline hover:text-sky-300">
          Back to competitions
        </Link>
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
            roundNumber={lastScoreRound}
            liveScoreCm={lastScoreCm}
            isBullseye={lastIsBullseye}
            resultLabel={lastResultLabel}
            hasLastScore={hasLastScore}
          />
        );
      case 'top10':
        return (
          <Top10Layout
            entries={overallEntries}
            highlightPilotNumber={currentPilot?.pilot?.pilotNumber}
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
            roundNumber={lastScoreRound}
            liveScoreCm={lastScoreCm}
            isBullseye={lastIsBullseye}
            resultLabel={lastResultLabel}
            hasLastScore={hasLastScore}
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
          <p className="text-xs uppercase tracking-[0.4em] text-sky-400/60">AeroJudge</p>
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
        layout={controlsLayout}
        onLayoutChange={handleLayoutChange}
        kioskMode={kioskMode}
        onKioskToggle={() => setKioskMode((k) => !k)}
      />
    </div>
  );
}
