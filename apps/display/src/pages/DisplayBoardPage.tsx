import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { DisplayControls } from '../components/DisplayControls';
import { LayoutRouter } from '../layouts/LayoutRouter';
import { CurrentPilotLayout } from '../layouts/CurrentPilotLayout';
import { RoundClosedLayout } from '../layouts/RoundClosedLayout';
import { RoundAwaitingLayout } from '../layouts/RoundAwaitingLayout';
import { CompletedPodiumLayout, type PodiumCategory } from '../layouts/CompletedPodiumLayout';
import { Top10Layout } from '../layouts/Top10Layout';
import { TopWomenLayout } from '../layouts/TopWomenLayout';
import { TopTeamsLayout } from '../layouts/TopTeamsLayout';
import { CountryLayout } from '../layouts/CountryLayout';
import { NextPilotsLayout } from '../layouts/NextPilotsLayout';
import { SponsorsLayout } from '../layouts/SponsorsLayout';
import { useCompetition, useLatestScore, useResults, useRoundsStatus, useSponsors, toLeaderboardEntries } from '../hooks/useCompetition';
import { useDisplaySocket } from '../hooks/useDisplaySocket';
import { AUTO_LAYOUT_SEQUENCE, type DisplayLayoutType, type PublicRankingRow } from '../lib/types';
import { getAutoInterval, getLayoutFromQuery, getScoreHoldSeconds, isKioskMode } from '../lib/utils';

const LIVE_ROUND_STATUSES = new Set(['ACTIVE', 'OPEN', 'PAUSED', 'BRIEFING']);
const CLOSED_LIKE_STATUSES = new Set([
  'CLOSED',
  'PENDING_APPROVAL',
  'APPROVED',
  'LOCKED',
]);

function resolveRoundPhase(rounds: { number: number; status: string }[] | undefined): {
  phase: 'live' | 'closed' | 'idle';
  activeRoundNumber: number | null;
  closedRoundNumber: number | null;
  nextRoundNumber: number | null;
} {
  if (!rounds?.length) {
    return {
      phase: 'idle',
      activeRoundNumber: null,
      closedRoundNumber: null,
      nextRoundNumber: null,
    };
  }

  const active = [...rounds]
    .filter((r) => LIVE_ROUND_STATUSES.has(r.status))
    .sort((a, b) => b.number - a.number)[0];
  if (active) {
    return {
      phase: 'live',
      activeRoundNumber: active.number,
      closedRoundNumber: null,
      nextRoundNumber: null,
    };
  }

  const closed = [...rounds]
    .filter((r) => CLOSED_LIKE_STATUSES.has(r.status))
    .sort((a, b) => b.number - a.number)[0];
  if (!closed) {
    return {
      phase: 'idle',
      activeRoundNumber: null,
      closedRoundNumber: null,
      nextRoundNumber: null,
    };
  }

  const scheduledNext = rounds
    .filter((r) => r.status === 'SCHEDULED' && r.number > closed.number)
    .sort((a, b) => a.number - b.number)[0];

  return {
    phase: 'closed',
    activeRoundNumber: null,
    closedRoundNumber: closed.number,
    nextRoundNumber: scheduledNext?.number ?? closed.number + 1,
  };
}

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

  const { data: competition, isLoading: compLoading, error: compError, refetch: refetchCompetition } = useCompetition();
  const { data: overallResults, invalidate: refreshOverall } = useResults('OVERALL');
  const { data: womenResults } = useResults('WOMEN');
  const { data: teamResults } = useResults('TEAM');
  const { data: countryResults } = useResults('COUNTRY');
  const { data: sponsors = [] } = useSponsors();
  const { data: persistedLatest } = useLatestScore();
  const { data: roundsStatus, invalidate: refreshRoundsStatus } = useRoundsStatus();

  const competitionCompleted = competition?.status === 'COMPLETED';
  const [podiumCategory, setPodiumCategory] = useState<PodiumCategory>('individual');

  const roundPhase = useMemo(
    () => resolveRoundPhase(roundsStatus?.rounds),
    [roundsStatus?.rounds],
  );

  const socketState = useDisplaySocket(
    competition?.id,
    refreshOverall,
    () => {
      refreshRoundsStatus();
      void refetchCompetition();
    },
    roundPhase.activeRoundNumber,
  );

  useEffect(() => {
    if (roundPhase.activeRoundNumber == null) return;
    socketState.clearStaleScoresBeforeRound(roundPhase.activeRoundNumber);
  }, [roundPhase.activeRoundNumber, socketState.clearStaleScoresBeforeRound]);

  useEffect(() => {
    if (!persistedLatest) return;
    // Ignore scores from a previous round once a newer round is live.
    if (
      roundPhase.activeRoundNumber != null &&
      persistedLatest.roundNumber < roundPhase.activeRoundNumber
    ) {
      return;
    }
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
  }, [
    persistedLatest,
    socketState.seedLatestScore,
    roundPhase.activeRoundNumber,
  ]);

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

  const overallEntries = useMemo(() => toLeaderboardEntries(overallResults), [overallResults]);
  const womenEntries = useMemo(() => toLeaderboardEntries(womenResults), [womenResults]);
  const teamEntries = useMemo(() => toLeaderboardEntries(teamResults), [teamResults]);
  const countryEntries = useMemo(() => toLeaderboardEntries(countryResults), [countryResults]);

  const tabVisibility = useMemo(
    () => ({
      women: womenEntries.length > 0,
      teams: teamEntries.length > 0,
      country: countryEntries.length > 0,
      sponsors: sponsors.length > 0,
    }),
    [womenEntries.length, teamEntries.length, countryEntries.length, sponsors.length],
  );

  const isLayoutAvailable = useCallback(
    (layoutId: DisplayLayoutType) => {
      if (layoutId === 'women') return tabVisibility.women;
      if (layoutId === 'teams') return tabVisibility.teams;
      if (layoutId === 'country') return tabVisibility.country;
      if (layoutId === 'sponsors') return tabVisibility.sponsors;
      return true;
    },
    [tabVisibility],
  );

  const autoSequence = useMemo(
    () => AUTO_LAYOUT_SEQUENCE.filter((id) => isLayoutAvailable(id)),
    [isLayoutAvailable],
  );

  const baseLayout = socketState.layoutOverride ?? layout;
  const inAuto = !scoreFocusActive && baseLayout === 'auto';
  const activeLayout: DisplayLayoutType = (() => {
    if (scoreFocusActive) return 'current';
    if (baseLayout === 'auto') {
      if (autoSequence.length === 0) return 'current';
      return autoSequence[autoIndex % autoSequence.length] ?? 'current';
    }
    if (!isLayoutAvailable(baseLayout)) return 'top10';
    return baseLayout;
  })();
  const controlsLayout: DisplayLayoutType = scoreFocusActive
    ? 'current'
    : baseLayout === 'auto'
      ? 'auto'
      : activeLayout;

  useEffect(() => {
    document.body.classList.toggle('kiosk-mode', kioskMode);
    return () => document.body.classList.remove('kiosk-mode');
  }, [kioskMode]);

  useEffect(() => {
    if (!inAuto || autoSequence.length === 0) return;
    const interval = getAutoInterval();
    const timer = setInterval(() => {
      setAutoIndex((i) => (i + 1) % autoSequence.length);
    }, interval * 1000);
    return () => clearInterval(timer);
  }, [inAuto, autoSequence.length]);

  // Leave empty optional layouts if URL/socket still points there.
  useEffect(() => {
    if (layout === 'auto') return;
    if (!isLayoutAvailable(layout)) {
      setLayout('top10');
      const url = new URL(window.location.href);
      url.searchParams.set('layout', 'top10');
      window.history.replaceState({}, '', url);
    }
  }, [layout, isLayoutAvailable]);

  // Rotate individual ↔ team podium when the competition is finished.
  useEffect(() => {
    if (!competitionCompleted) {
      setPodiumCategory('individual');
      return;
    }
    if (teamEntries.length === 0) {
      setPodiumCategory('individual');
      return;
    }
    const intervalMs = Math.max(getAutoInterval(), 12) * 1000;
    const timer = setInterval(() => {
      setPodiumCategory((prev) => (prev === 'individual' ? 'team' : 'individual'));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [competitionCompleted, teamEntries.length]);

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
    (roundPhase.activeRoundNumber != null ? null : persistedLatest?.roundNumber) ??
    roundPhase.activeRoundNumber ??
    1;

  const scoreForActiveRound =
    roundPhase.phase === 'live' &&
    roundPhase.activeRoundNumber != null &&
    latestScore != null &&
    latestScore.roundNumber === roundPhase.activeRoundNumber;

  const awaitingFirstScore =
    roundPhase.phase === 'live' &&
    roundPhase.activeRoundNumber != null &&
    !scoreForActiveRound;

  const lastScoreCm = scoreForActiveRound ? (latestScore?.scoreCm ?? null) : null;
  const lastIsBullseye = scoreForActiveRound ? (latestScore?.isBullseye ?? false) : false;
  const lastResultLabel = scoreForActiveRound ? latestScore?.resultLabel : undefined;
  const hasLastScore = scoreForActiveRound;

  const currentLayoutProps = {
    pilot: currentPilot,
    competitionName: competition?.name,
    roundNumber: roundPhase.activeRoundNumber ?? lastScoreRound,
    liveScoreCm: lastScoreCm,
    isBullseye: lastIsBullseye,
    resultLabel: lastResultLabel,
    hasLastScore,
  };

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
    if (competitionCompleted) {
      const entries = podiumCategory === 'team' ? teamEntries : overallEntries;
      return (
        <CompletedPodiumLayout
          competitionName={competition.name}
          entries={entries}
          category={podiumCategory}
        />
      );
    }

    const showRoundInterstitial = activeLayout === 'current' || activeLayout === 'next';

    if (showRoundInterstitial && roundPhase.phase === 'closed') {
      return (
        <RoundClosedLayout
          closedRoundNumber={roundPhase.closedRoundNumber!}
          nextRoundNumber={roundPhase.nextRoundNumber!}
          competitionName={competition.name}
        />
      );
    }

    if (showRoundInterstitial && awaitingFirstScore) {
      return (
        <RoundAwaitingLayout
          roundNumber={roundPhase.activeRoundNumber!}
          competitionName={competition.name}
        />
      );
    }

    switch (activeLayout) {
      case 'current':
        return <CurrentPilotLayout {...currentLayoutProps} />;
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
        return <CurrentPilotLayout {...currentLayoutProps} />;
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

      <main className={`h-full pt-20 ${competitionCompleted ? 'pb-0' : 'pb-16'}`}>
        <LayoutRouter
          layoutKey={
            competitionCompleted
              ? 'completed-podium'
              : awaitingFirstScore
                ? `awaiting-r${roundPhase.activeRoundNumber}`
                : roundPhase.phase === 'closed'
                  ? `closed-r${roundPhase.closedRoundNumber}`
                  : activeLayout
          }
        >
          {renderLayout()}
        </LayoutRouter>
      </main>

      {!competitionCompleted && (
        <DisplayControls
          layout={controlsLayout}
          onLayoutChange={handleLayoutChange}
          kioskMode={kioskMode}
          onKioskToggle={() => setKioskMode((k) => !k)}
          partnersLabel={competition.settings?.partnersLabel?.trim() || 'Sponsors'}
          tabVisibility={tabVisibility}
        />
      )}
    </div>
  );
}
