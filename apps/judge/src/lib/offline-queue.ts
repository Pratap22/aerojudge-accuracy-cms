import type { EnterScoreInput } from '@npha/shared';
import { api } from './api';

const QUEUE_KEY = 'npha_judge_offline_queue';

export interface PendingScore extends EnterScoreInput {
  id: string;
  competitionId: string;
  roundId: string;
  createdAt: string;
  retries: number;
}

function loadQueue(): PendingScore[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingScore[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingScore[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getPendingScores(): PendingScore[] {
  return loadQueue();
}

export function getPendingCount(): number {
  return loadQueue().length;
}

export function enqueueScore(
  competitionId: string,
  roundId: string,
  score: EnterScoreInput,
): PendingScore {
  const entry: PendingScore = {
    ...score,
    id: crypto.randomUUID(),
    competitionId,
    roundId,
    createdAt: new Date().toISOString(),
    retries: 0,
  };
  const queue = loadQueue();
  queue.push(entry);
  saveQueue(queue);
  return entry;
}

export function removeFromQueue(id: string): void {
  saveQueue(loadQueue().filter((s) => s.id !== id));
}

export async function syncPendingScores(): Promise<{ synced: number; failed: number }> {
  const queue = loadQueue();
  let synced = 0;
  let failed = 0;

  for (const entry of queue) {
    try {
      await api.post(
        `/competitions/${entry.competitionId}/rounds/${entry.roundId}/scores`,
        {
          flightId: entry.flightId,
          distanceCm: entry.distanceCm,
          resultType: entry.resultType,
          penaltyCm: entry.penaltyCm,
          judgeNotes: entry.judgeNotes,
        },
      );
      removeFromQueue(entry.id);
      synced++;
    } catch {
      entry.retries++;
      failed++;
    }
  }

  saveQueue(loadQueue());
  return { synced, failed };
}

export function subscribeOnlineSync(onUpdate: (count: number) => void): () => void {
  const handler = async () => {
    if (navigator.onLine && getPendingCount() > 0) {
      await syncPendingScores();
      onUpdate(getPendingCount());
    }
  };

  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
