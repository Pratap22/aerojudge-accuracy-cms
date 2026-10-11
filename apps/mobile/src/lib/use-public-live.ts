import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { connectPublicSocket, disconnectSocket, onSocketEvent, onSocketReconnect } from './socket';

/**
 * Subscribe to the public Socket.IO room and refresh published standings when they change.
 * Returns whether the live connection is currently open.
 */
export function usePublicLiveUpdates(competitionId: string): boolean {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!competitionId) return;

    let socket: Socket;
    try {
      socket = connectPublicSocket(competitionId);
    } catch {
      setConnected(false);
      return;
    }

    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['public-competition', competitionId] });
      void queryClient.invalidateQueries({ queryKey: ['public-results', competitionId] });
    };
    const matches = (id: string) => id === competitionId;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setConnected(socket.connected);

    const unsubs = [
      onSocketEvent('ranking:updated', (payload) => {
        if (matches(payload.competitionId)) refresh();
      }),
      onSocketEvent('results:published', (payload) => {
        if (matches(payload.competitionId)) refresh();
      }),
      onSocketEvent('score:updated', (payload) => {
        if (matches(payload.competitionId)) refresh();
      }),
      onSocketEvent('competition:status', (payload) => {
        if (matches(payload.competitionId)) refresh();
      }),
      onSocketReconnect(refresh),
    ];

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      disconnectSocket();
      setConnected(false);
    };
  }, [competitionId, queryClient]);

  return connected;
}
