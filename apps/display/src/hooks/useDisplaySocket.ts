import { useEffect, useState, useCallback } from 'react';
import type { ComputedScore, RankingCategory } from '@npha/shared';
import { connectDisplaySocket, disconnectSocket, onSocketEvent } from '../lib/socket';
import type { DisplayLayoutType, LiveScore, WindData } from '../lib/types';

interface DisplaySocketState {
  currentPilotId: string | null;
  currentFlightId: string | null;
  latestScore: LiveScore | null;
  layoutOverride: DisplayLayoutType | null;
  wind: WindData | null;
  lastRankingUpdate: RankingCategory | null;
}

const initialState: DisplaySocketState = {
  currentPilotId: null,
  currentFlightId: null,
  latestScore: null,
  layoutOverride: null,
  wind: null,
  lastRankingUpdate: null,
};

export function useDisplaySocket(competitionId: string | undefined, onRankingUpdate?: () => void) {
  const [state, setState] = useState<DisplaySocketState>(initialState);

  const handleScoreUpdate = useCallback((payload: { score: ComputedScore }) => {
    const score = payload.score;
    setState((prev) => ({
      ...prev,
      latestScore: {
        pilotId: score.pilotId,
        pilotNumber: 0,
        firstName: '',
        lastName: '',
        countryCode: '',
        scoreCm: score.finalScoreCm,
        isBullseye: score.isBullseye,
        resultLabel: score.resultType !== 'MEASURED' && score.resultType !== 'BULLSEYE'
          ? score.resultType
          : undefined,
        roundNumber: 0,
        rank: 0,
      },
    }));
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
        handleScoreUpdate(payload);
      }),
      onSocketEvent('ranking:updated', (payload) => {
        if (payload.competitionId !== competitionId) return;
        setState((prev) => ({ ...prev, lastRankingUpdate: payload.category }));
        onRankingUpdate?.();
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
  }, [competitionId, handleScoreUpdate, onRankingUpdate]);

  return state;
}
