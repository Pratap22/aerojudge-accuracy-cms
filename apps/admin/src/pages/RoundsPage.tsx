import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pause, Play, Square, CheckCircle, RotateCcw } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@npha/ui';
import type { RoundStatus, RoundType } from '@npha/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Round {
  id: string;
  number: number;
  name: string;
  type: RoundType;
  status: RoundStatus;
  scheduledAt: string | null;
  flightsTotal: number;
  flightsScored: number;
}

const statusColors: Record<RoundStatus, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  SCHEDULED: 'outline' as 'default',
  BRIEFING: 'secondary',
  OPEN: 'secondary',
  ACTIVE: 'success',
  PAUSED: 'warning',
  CLOSED: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  LOCKED: 'default',
  CANCELLED: 'destructive',
};

type RoundAction = 'start' | 'pause' | 'resume' | 'close' | 'approve';

export function RoundsPage() {
  const { activeCompetitionId } = useAuth();
  const queryClient = useQueryClient();

  const { data: rounds, isLoading } = useQuery({
    queryKey: ['rounds', activeCompetitionId],
    queryFn: () => api.get<Round[]>(`/competitions/${activeCompetitionId}/rounds`),
    enabled: !!activeCompetitionId,
  });

  const actionMutation = useMutation({
    mutationFn: ({ roundId, action }: { roundId: string; action: RoundAction }) =>
      api.post<Round>(`/competitions/${activeCompetitionId}/rounds/${roundId}/${action}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rounds'] }),
  });

  const getActions = (status: RoundStatus): { action: RoundAction; label: string; icon: React.ReactNode }[] => {
    switch (status) {
      case 'SCHEDULED':
      case 'OPEN':
        return [{ action: 'start', label: 'Start', icon: <Play className="h-4 w-4" /> }];
      case 'ACTIVE':
        return [
          { action: 'pause', label: 'Pause', icon: <Pause className="h-4 w-4" /> },
          { action: 'close', label: 'Close', icon: <Square className="h-4 w-4" /> },
        ];
      case 'PAUSED':
        return [
          { action: 'resume', label: 'Resume', icon: <RotateCcw className="h-4 w-4" /> },
          { action: 'close', label: 'Close', icon: <Square className="h-4 w-4" /> },
        ];
      case 'CLOSED':
      case 'PENDING_APPROVAL':
        return [{ action: 'approve', label: 'Approve', icon: <CheckCircle className="h-4 w-4" /> }];
      default:
        return [];
    }
  };

  if (!activeCompetitionId) {
    return <p className="text-muted-foreground">Select an active competition from the dashboard.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rounds</h1>
        <p className="text-muted-foreground">Control round lifecycle and flight operations</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Rounds</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{rounds?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-secondary">
              {rounds?.filter((r) => r.status === 'ACTIVE').length ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {rounds?.filter((r) => r.status === 'APPROVED' || r.status === 'LOCKED').length ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Round</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (
              rounds?.map((round) => (
                <TableRow key={round.id}>
                  <TableCell className="font-medium">
                    R{round.number} {round.name && `– ${round.name}`}
                  </TableCell>
                  <TableCell>{round.type}</TableCell>
                  <TableCell>
                    <Badge variant={statusColors[round.status]}>{round.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {round.flightsScored}/{round.flightsTotal} scored
                  </TableCell>
                  <TableCell>
                    {round.scheduledAt ? new Date(round.scheduledAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {getActions(round.status).map(({ action, label, icon }) => (
                        <Button
                          key={action}
                          size="sm"
                          variant={action === 'start' || action === 'approve' ? 'default' : 'outline'}
                          disabled={actionMutation.isPending}
                          onClick={() => actionMutation.mutate({ roundId: round.id, action })}
                        >
                          {icon}
                          <span className="ml-1">{label}</span>
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
