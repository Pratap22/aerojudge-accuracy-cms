import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, Target } from 'lucide-react';
import { Badge, Button, Card, CardContent } from '@npha/ui';
import type { RoundStatus } from '@npha/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface RoundOption {
  id: string;
  number: number;
  name: string;
  status: RoundStatus;
  flightsScored: number;
  flightsTotal: number;
}

interface CompetitionOption {
  id: string;
  name: string;
  code: string;
}

const statusVariant: Record<RoundStatus, 'default' | 'secondary' | 'success' | 'warning'> = {
  SCHEDULED: 'outline' as 'default',
  BRIEFING: 'secondary',
  OPEN: 'secondary',
  ACTIVE: 'success',
  PAUSED: 'warning',
  CLOSED: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'default',
  LOCKED: 'default',
  CANCELLED: 'outline' as 'default',
};

export function RoundSelectPage() {
  const { user, competitionId, setCompetitionId, logout } = useAuth();
  const navigate = useNavigate();

  const { data: competitions } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => api.get<CompetitionOption[]>('/competitions'),
  });

  const activeCompId = competitionId ?? competitions?.[0]?.id;

  const { data: rounds, isLoading } = useQuery({
    queryKey: ['rounds', activeCompId],
    queryFn: () => api.get<RoundOption[]>(`/competitions/${activeCompId}/rounds`),
    enabled: !!activeCompId,
  });

  const selectRound = (roundId: string) => {
    if (activeCompId) setCompetitionId(activeCompId);
    navigate(`/score/${roundId}`);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-sky-400" />
          <div>
            <p className="font-semibold">Select Round</p>
            <p className="text-sm text-slate-400">
              {user?.firstName} {user?.lastName} · {user?.role.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="text-slate-400 hover:text-white">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </header>

      <main className="mx-auto max-w-2xl p-6">
        {competitions && competitions.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {competitions.map((c) => (
              <Button
                key={c.id}
                variant={c.id === activeCompId ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCompetitionId(c.id)}
              >
                {c.code}
              </Button>
            ))}
          </div>
        )}

        {isLoading ? (
          <p className="text-center text-slate-400">Loading rounds…</p>
        ) : (
          <div className="space-y-3">
            {rounds?.map((round) => (
              <Card
                key={round.id}
                className="cursor-pointer border-slate-700 bg-slate-800 transition-colors hover:border-sky-500/50 hover:bg-slate-750 active:scale-[0.99]"
                onClick={() => selectRound(round.id)}
              >
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-2xl font-bold text-sky-400">R{round.number}</span>
                      <span className="text-lg font-medium">{round.name || `Round ${round.number}`}</span>
                      <Badge variant={statusVariant[round.status]}>{round.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      {round.flightsScored}/{round.flightsTotal} flights scored
                    </p>
                  </div>
                  <ChevronRight className="h-6 w-6 text-slate-500" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
