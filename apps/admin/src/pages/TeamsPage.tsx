import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTeamSchema,
  type CreateTeamInput,
  type RuleConfig,
  type TeamType,
} from '@npha/shared';
import { AlertCircle, CheckCircle2, Pencil, Plus, Users } from 'lucide-react';
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
import { useCompetitionId } from '../hooks/useCompetitionId';

interface PilotOption {
  id: string;
  pilotNumber: number;
  firstName: string;
  lastName: string;
}

interface TeamMemberApi {
  id: string;
  pilotId: string;
  role: 'PILOT' | 'RESERVE' | 'CAPTAIN' | 'VICE_CAPTAIN';
  order: number;
  pilot: PilotOption;
}

interface TeamApi {
  id: string;
  name: string;
  type: TeamType;
  isValid: boolean;
  validationNotes: string | null;
  members: TeamMemberApi[];
}

type MemberRole = 'PILOT' | 'RESERVE';

function pilotLabel(p: Pick<PilotOption, 'pilotNumber' | 'firstName' | 'lastName'>) {
  return `#${p.pilotNumber} ${p.firstName} ${p.lastName}`;
}

export function TeamsPage() {
  const activeCompetitionId = useCompetitionId();
  const [formOpen, setFormOpen] = useState(false);
  const [managingTeam, setManagingTeam] = useState<TeamApi | null>(null);
  const [selectedPilotIds, setSelectedPilotIds] = useState<string[]>([]);
  const [reserveIds, setReserveIds] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams', activeCompetitionId],
    queryFn: () => api.get<TeamApi[]>(`/competitions/${activeCompetitionId}/teams`),
    enabled: !!activeCompetitionId,
  });

  const { data: rules } = useQuery({
    queryKey: ['settings', activeCompetitionId],
    queryFn: () => api.get<RuleConfig>(`/competitions/${activeCompetitionId}/rules`),
    enabled: !!activeCompetitionId,
  });

  const teamSize = rules?.teamSize ?? 4;
  const scoringPilots = rules?.teamScoringPilots ?? 3;
  const maxReserves = rules?.teamAllowReserves ? (rules?.teamMaxReserves ?? 1) : 0;
  const maxMembers = teamSize + maxReserves;

  const { data: pilots, isLoading: pilotsLoading } = useQuery({
    queryKey: ['pilots', activeCompetitionId, 'team-picker'],
    queryFn: () =>
      api.get<PilotOption[]>(`/competitions/${activeCompetitionId}/pilots`, { pageSize: 200 }),
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
    defaultValues: { type: 'NATIONAL', name: '' },
  });

  const teamType = watch('type');

  const pilotTeamMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const team of teams ?? []) {
      for (const member of team.members ?? []) {
        map.set(member.pilotId, team.name);
      }
    }
    return map;
  }, [teams]);

  const pilotById = useMemo(() => {
    const map = new Map<string, PilotOption>();
    for (const p of pilots ?? []) {
      map.set(p.id, p);
    }
    for (const team of teams ?? []) {
      for (const member of team.members ?? []) {
        if (!map.has(member.pilotId)) {
          map.set(member.pilotId, member.pilot);
        }
      }
    }
    return map;
  }, [pilots, teams]);

  const createMutation = useMutation({
    mutationFn: (data: CreateTeamInput) =>
      api.post<TeamApi>(`/competitions/${activeCompetitionId}/teams`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setFormOpen(false);
      reset({ type: 'NATIONAL', name: '' });
    },
  });

  const membersMutation = useMutation({
    mutationFn: ({
      teamId,
      pilotIds,
      roles,
    }: {
      teamId: string;
      pilotIds: string[];
      roles: MemberRole[];
    }) =>
      api.put(`/competitions/${activeCompetitionId}/teams/${teamId}/members`, { pilotIds, roles }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setManagingTeam(null);
      setMemberSearch('');
    },
  });

  const selectedPilots = useMemo(() => {
    return selectedPilotIds
      .map((id) => pilotById.get(id))
      .filter((p): p is PilotOption => Boolean(p));
  }, [selectedPilotIds, pilotById]);

  const availablePilots = useMemo(() => {
    if (!managingTeam) return [];
    const q = memberSearch.trim().toLowerCase();
    const list = [...pilotById.values()].sort((a, b) => a.pilotNumber - b.pilotNumber);

    return list.filter((p) => {
      if (!q) return true;
      const otherTeam = pilotTeamMap.get(p.id);
      return (
        String(p.pilotNumber).includes(q) ||
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        (otherTeam?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [managingTeam, pilotById, memberSearch, pilotTeamMap]);

  function openManageMembers(team: TeamApi) {
    const ordered = [...team.members].sort((a, b) => a.order - b.order);
    setSelectedPilotIds(ordered.map((m) => m.pilotId));
    setReserveIds(new Set(ordered.filter((m) => m.role === 'RESERVE').map((m) => m.pilotId)));
    setMemberSearch('');
    setManagingTeam(team);
  }

  function togglePilot(pilotId: string) {
    if (!managingTeam) return;
    const otherTeam = pilotTeamMap.get(pilotId);
    if (otherTeam && otherTeam !== managingTeam.name) return;

    setSelectedPilotIds((prev) => {
      if (prev.includes(pilotId)) {
        setReserveIds((r) => {
          const next = new Set(r);
          next.delete(pilotId);
          return next;
        });
        return prev.filter((id) => id !== pilotId);
      }
      if (prev.length >= maxMembers) return prev;
      return [...prev, pilotId];
    });
  }

  function toggleReserve(pilotId: string) {
    if (!selectedPilotIds.includes(pilotId) || maxReserves <= 0) return;
    setReserveIds((prev) => {
      const next = new Set(prev);
      if (next.has(pilotId)) {
        next.delete(pilotId);
        return next;
      }
      if (next.size >= maxReserves) return prev;
      next.add(pilotId);
      return next;
    });
  }

  function saveMembers() {
    if (!managingTeam) return;
    const roles: MemberRole[] = selectedPilotIds.map((id) =>
      reserveIds.has(id) ? 'RESERVE' : 'PILOT',
    );
    membersMutation.mutate({
      teamId: managingTeam.id,
      pilotIds: selectedPilotIds,
      roles,
    });
  }

  if (!activeCompetitionId) {
    return (
      <p className="text-muted-foreground">
        <Link to="/competitions" className="text-primary underline">
          Open a competition
        </Link>{' '}
        from the Competitions list.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-muted-foreground">
            National and club team composition · {teamSize} scoring slots
            {maxReserves > 0 ? ` + ${maxReserves} reserve` : ''} · count best {scoringPilots}{' '}
            (from competition settings)
          </p>
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
          {teams?.map((team) => {
            const issues =
              team.validationNotes
                ?.split(';')
                .map((s) => s.trim())
                .filter(Boolean) ?? [];
            const members = [...(team.members ?? [])].sort((a, b) => a.order - b.order);

            return (
              <Card key={team.id} className={team.isValid ? '' : 'border-amber-500/50'}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <Users className="h-5 w-5 text-primary" />
                    <Badge variant={team.isValid ? 'success' : 'warning'}>
                      {team.isValid ? 'Valid' : 'Issues'}
                    </Badge>
                  </div>
                  <CardTitle>{team.name}</CardTitle>
                  <CardDescription>
                    {team.type} · {members.length}/{maxMembers} members
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No members assigned yet.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {members.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2">
                          <span>{pilotLabel(m.pilot)}</span>
                          {m.role === 'RESERVE' && (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              Reserve
                            </Badge>
                          )}
                          {(m.role === 'CAPTAIN' || m.role === 'VICE_CAPTAIN') && (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {m.role === 'CAPTAIN' ? 'Captain' : 'Vice'}
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {!team.isValid && issues.length > 0 && (
                    <div className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                      {issues.map((err) => (
                        <p key={err} className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" /> {err}
                        </p>
                      ))}
                    </div>
                  )}
                  {team.isValid && (
                    <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Ready for team scoring
                    </p>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => openManageMembers(team)}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Manage Members
                  </Button>
                </CardContent>
              </Card>
            );
          })}
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
            <p className="text-xs text-muted-foreground">
              Team size ({teamSize}), scoring pilots ({scoringPilots}), and reserves ({maxReserves}){' '}
              are set in Competition Settings.
            </p>
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

      <Dialog
        open={!!managingTeam}
        onOpenChange={(open) => {
          if (!open) {
            setManagingTeam(null);
            setMemberSearch('');
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Members — {managingTeam?.name}</DialogTitle>
          </DialogHeader>
          {managingTeam && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select up to {maxMembers} pilots
                {maxReserves > 0 ? ` (mark up to ${maxReserves} as reserve)` : ''}. Limits come from
                competition settings. A pilot can only belong to one team.
              </p>

              <div className="space-y-2">
                <Label>
                  Selected ({selectedPilotIds.length}/{maxMembers})
                </Label>
                <div className="space-y-1 rounded-md border bg-muted/30 p-2">
                  {selectedPilots.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-muted-foreground">No pilots selected.</p>
                  ) : (
                    selectedPilots.map((pilot) => {
                      const isReserve = reserveIds.has(pilot.id);
                      return (
                        <div
                          key={pilot.id}
                          className="flex items-center gap-3 rounded-md bg-background px-2 py-1.5"
                        >
                          <span className="min-w-0 flex-1 text-sm font-medium">
                            {pilotLabel(pilot)}
                          </span>
                          {maxReserves > 0 && (
                            <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 rounded"
                                checked={isReserve}
                                disabled={!isReserve && reserveIds.size >= maxReserves}
                                onChange={() => toggleReserve(pilot.id)}
                              />
                              Reserve
                            </label>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => togglePilot(pilot.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Add pilots</Label>
                <Input
                  placeholder="Search pilots…"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
                  {pilotsLoading ? (
                    <p className="p-2 text-sm text-muted-foreground">Loading pilots…</p>
                  ) : (
                    availablePilots.map((pilot) => {
                      const selected = selectedPilotIds.includes(pilot.id);
                      const otherTeam = pilotTeamMap.get(pilot.id);
                      const onOtherTeam = Boolean(
                        otherTeam && otherTeam !== managingTeam.name,
                      );
                      const atCapacity = !selected && selectedPilotIds.length >= maxMembers;
                      const disabled = onOtherTeam || atCapacity;

                      return (
                        <div
                          key={pilot.id}
                          className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${
                            disabled && !selected ? 'opacity-50' : 'hover:bg-muted/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded"
                            checked={selected}
                            disabled={disabled && !selected}
                            onChange={() => togglePilot(pilot.id)}
                          />
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left text-sm disabled:cursor-not-allowed"
                            disabled={disabled && !selected}
                            onClick={() => togglePilot(pilot.id)}
                          >
                            {pilotLabel(pilot)}
                          </button>
                          {onOtherTeam && (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {otherTeam}
                            </Badge>
                          )}
                        </div>
                      );
                    })
                  )}
                  {!pilotsLoading && availablePilots.length === 0 && (
                    <p className="p-2 text-sm text-muted-foreground">No pilots found.</p>
                  )}
                </div>
              </div>

              {membersMutation.isError && (
                <p className="text-sm text-destructive">
                  {(membersMutation.error as Error)?.message ?? 'Failed to save members'}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setManagingTeam(null);
                    setMemberSearch('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={selectedPilotIds.length === 0 || membersMutation.isPending}
                  onClick={saveMembers}
                >
                  {membersMutation.isPending ? 'Saving…' : 'Save Members'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
