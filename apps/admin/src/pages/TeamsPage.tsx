import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTeamSchema, type CreateTeamInput, type TeamType } from '@npha/shared';
import { AlertCircle, CheckCircle2, Plus, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@npha/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface TeamMember {
  id: string;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  isReserve: boolean;
}

interface Team extends CreateTeamInput {
  id: string;
  members: TeamMember[];
  isValid: boolean;
  validationErrors: string[];
}

export function TeamsPage() {
  const { activeCompetitionId } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams', activeCompetitionId],
    queryFn: () => api.get<Team[]>(`/competitions/${activeCompetitionId}/teams`),
    enabled: !!activeCompetitionId,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateTeamInput>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: { type: 'NATIONAL', maxSize: 4, scoringPilots: 3, maxReserves: 1, name: '' },
  });

  const teamType = watch('type');

  const createMutation = useMutation({
    mutationFn: (data: CreateTeamInput) =>
      api.post<Team>(`/competitions/${activeCompetitionId}/teams`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setFormOpen(false);
      reset();
    },
  });

  if (!activeCompetitionId) {
    return <p className="text-muted-foreground">Select an active competition from the dashboard.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-muted-foreground">National and club team composition</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Team
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teams?.map((team) => (
            <Card key={team.id} className={team.isValid ? '' : 'border-amber-500/50'}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Users className="h-5 w-5 text-secondary" />
                  <Badge variant={team.isValid ? 'success' : 'warning'}>
                    {team.isValid ? 'Valid' : 'Issues'}
                  </Badge>
                </div>
                <CardTitle>{team.name}</CardTitle>
                <CardDescription>
                  {team.type} · {team.members.length}/{team.maxSize} members
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1 text-sm">
                  {team.members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between">
                      <span>
                        #{m.pilotNumber} {m.firstName} {m.lastName}
                      </span>
                      {m.isReserve && (
                        <Badge variant="outline" className="text-[10px]">
                          Reserve
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
                {!team.isValid && (
                  <div className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                    {team.validationErrors.map((err) => (
                      <p key={err} className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {err}
                      </p>
                    ))}
                  </div>
                )}
                {team.isValid && (
                  <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Ready for team scoring
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={teamType} onValueChange={(v) => setValue('type', v as TeamType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NATIONAL">National</SelectItem>
                  <SelectItem value="CLUB">Club</SelectItem>
                  <SelectItem value="WOMEN">Women</SelectItem>
                  <SelectItem value="MIXED">Mixed</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Max Size</Label>
                <Input type="number" {...register('maxSize', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Scoring</Label>
                <Input type="number" {...register('scoringPilots', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Reserves</Label>
                <Input type="number" {...register('maxReserves', { valueAsNumber: true })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
