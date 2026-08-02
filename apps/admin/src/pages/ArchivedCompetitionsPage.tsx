import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArchiveRestore, Trophy } from 'lucide-react';
import type { CompetitionStatus } from '@npha/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@npha/ui';
import { api } from '../lib/api';
import { usePermission } from '../hooks/usePermission';
import { competitionPath } from '../hooks/useCompetitionId';
import { useAuth } from '../lib/auth';
import { defaultCompetitionSegment } from '../layouts/AppLayout';

interface Competition {
  id: string;
  name: string;
  code: string;
  venue: string;
  status: CompetitionStatus;
  startDate: string;
  endDate: string;
}

/**
 * Soft-archived competitions — Super Admin / directors with update permission.
 * Not shown on public sites.
 */
export function ArchivedCompetitionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canUpdate = usePermission('competition:update');

  const { data: competitions, isLoading } = useQuery({
    queryKey: ['competitions', 'archived'],
    queryFn: () => api.get<Competition[]>('/competitions', { status: 'ARCHIVED' }),
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => api.post<Competition>(`/competitions/${id}/unarchive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
    },
  });

  if (!canUpdate) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Trophy className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Access Restricted</h2>
        <p className="text-muted-foreground">You do not have permission to manage archived competitions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Archived Competitions</h1>
          <p className="text-muted-foreground">
            Archived events are hidden from Display and Public Results. Unarchive restores them as
            COMPLETED (unpublished).
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/competitions">Back to Competitions</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : competitions?.length === 0 ? (
        <p className="text-muted-foreground">No archived competitions</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {competitions?.map((comp) => (
            <Card key={comp.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{comp.name}</CardTitle>
                  <Badge variant="outline">{comp.status}</Badge>
                </div>
                <CardDescription>
                  {comp.code} · {comp.venue}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={unarchiveMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Unarchive “${comp.name}”? It will be restored as COMPLETED and stay unpublished until you publish again.`,
                      )
                    ) {
                      unarchiveMutation.mutate(comp.id, {
                        onSuccess: () => {
                          navigate(competitionPath(comp.id, defaultCompetitionSegment(user)));
                        },
                      });
                    }
                  }}
                >
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  Unarchive
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
