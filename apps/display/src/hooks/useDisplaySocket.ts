import { useEffect, useState, useCallback, useRef } from 'react';
import type { ComputedScore, RankingCategory } from '@npha/shared';
import { connectDisplaySocket, disconnectSocket, onSocketEvent } from '../lib/socket';
import type { DisplayLayoutType, LiveScore, WindData } from '../lib/types';

interface DisplaySocketState {
  currentPilotId: string | null;
  currentFlightId: string | null;
  latestScore: LiveScore | null;
  /** Timestamp of the last live score:updated from a judge (not seed/persist). */
  lastLiveScoreAt: number | null;
  layoutOverride: DisplayLayoutType | null;
  wind: WindData | null;
  lastRankingUpdate: RankingCategory | null;
}

const initialState: DisplaySocketState = {
  currentPilotId: null,
  currentFlightId: null,
  latestScore: null,
  lastLiveScoreAt: null,
  layoutOverride: null,
  wind: null,
  lastRankingUpdate: null,
};

function resultLabelFromScore(score: ComputedScore): string | undefined {
  return score.resultType !== 'MEASURED' && score.resultType !== 'BULLSEYE'
    ? score.resultType
    : undefined;
}

export function useDisplaySocket(
  competitionId: string | undefined,
  onRankingUpdate?: () => void,
  onRoundStatus?: () => void,
  activeRoundNumber?: number | null,
) {
  const [state, setState] = useState<DisplaySocketState>(initialState);
  const activeRoundRef = useRef(activeRoundNumber ?? null);
  activeRoundRef.current = activeRoundNumber ?? null;

  const seedLatestScore = useCallback((score: LiveScore | null) => {
    if (!score) return;
    setState((prev) => {
      if (
        prev.latestScore &&
        prev.latestScore.pilotId === score.pilotId &&
        prev.latestScore.scoreCm === score.scoreCm
      ) {
        return {
          ...prev,
          latestScore: {
            ...prev.latestScore,
            roundNumber: score.roundNumber || prev.latestScore.roundNumber,
            firstName: prev.latestScore.firstName || score.firstName,
            lastName: prev.latestScore.lastName || score.lastName,
            pilotNumber: prev.latestScore.pilotNumber || score.pilotNumber,
            countryCode: prev.latestScore.countryCode || score.countryCode,
          },
        };
      }
      if (prev.latestScore) return prev;
      return {
        ...prev,
        latestScore: score,
        currentPilotId: prev.currentPilotId ?? score.pilotId,
      };
    });
  }, []);

  const clearStaleScoresBeforeRound = useCallback((activeRoundNumber: number) => {
    setState((prev) => {
      if (!prev.latestScore) return prev;
      if (prev.latestScore.roundNumber >= activeRoundNumber) return prev;
      return {
        ...prev,
        latestScore: null,
        lastLiveScoreAt: null,
        currentPilotId: null,
        currentFlightId: null,
      };
    });
  }, []);

  useEffect(() => {
    if (!competitionId) return;

    connectDisplaySocket(competitionId);

    const unsubs = [
      onSocketEvent('pilot:current', (payload) => {
        if (payload.competitionId !== competitionId) return;
        setState((prev) => ({
          ...prev,
          currentPilotId: payload.pilotId,
          currentFlightId: payload.flightId,
        }));
      }),
      onSocketEvent('score:updated', (payload) => {
        if (payload.competitionId !== competitionId) return;
        const score = payload.score;
        const pilot = payload.pilot;
        setState((prev) => ({
          ...prev,
          currentPilotId: score.pilotId,
          lastLiveScoreAt: Date.now(),
          latestScore: {
            pilotId: score.pilotId,
            pilotNumber: pilot?.pilotNumber ?? prev.latestScore?.pilotNumber ?? 0,
            firstName: pilot?.firstName ?? prev.latestScore?.firstName ?? '',
            lastName: pilot?.lastName ?? prev.latestScore?.lastName ?? '',
            countryCode:
              pilot?.countryCode ?? pilot?.country ?? prev.latestScore?.countryCode ?? '',
            scoreCm: score.finalScoreCm,
            isBullseye: score.isBullseye,
            resultLabel: resultLabelFromScore(score),
            roundNumber:
              activeRoundRef.current ??
              prev.latestScore?.roundNumber ??
              0,
            rank: 0,
          },
        }));
        onRankingUpdate?.();
      }),
      onSocketEvent('ranking:updated', (payload) => {
        if (payload.competitionId !== competitionId) return;
        setState((prev) => ({ ...prev, lastRankingUpdate: payload.category }));
        onRankingUpdate?.();
      }),
      onSocketEvent('round:status', (payload) => {
        if (payload.competitionId !== competitionId) return;
        onRoundStatus?.();
      }),
      onSocketEvent('display:layout', (payload) => {
        if (payload.competitionId !== competitionId) return;
        setState((prev) => ({
          ...prev,
          layoutOverride: payload.layoutType as DisplayLayoutType,
        }));
      }),
      onSocketEvent('wind:updated', (payload) => {
        if (payload.competitionId !== competitionId) return;
        setState((prev) => ({
          ...prev,
          wind: { directionDeg: payload.directionDeg, speedMs: payload.speedMs },
        }));
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
      disconnectSocket();
    };
  }, [competitionId, onRankingUpdate, onRoundStatus]);

  return { ...state, seedLatestScore, clearStaleScoresBeforeRound };
}
