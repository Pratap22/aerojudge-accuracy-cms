import { Link } from 'react-router-dom';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPilotSchema,
  type CreatePilotInput,
  type Gender,
  type PersonDirectoryEntry,
  type PilotStatus,
} from '@npha/shared';
import { Download, Pencil, Plus, Search, Upload, UserCheck, X } from 'lucide-react';
import {
  Badge,
  Button,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@npha/ui';
import { api, apiFetch } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';

interface Pilot {
  id: string;
  status: PilotStatus;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  gender: Gender;
  faiLicense?: string | null;
  nationality?: string | null;
  club?: string | null;
  civlId?: string | null;
  countryId?: string | null;
  personId?: string | null;
  person?: { id: string; aeroJudgeId: string; civlId?: string | null } | null;
}

function toFormValues(pilot: Pilot): CreatePilotInput {
  return {
    pilotNumber: pilot.pilotNumber,
    firstName: pilot.firstName,
    lastName: pilot.lastName,
    gender: pilot.gender,
    faiLicense: pilot.faiLicense ?? undefined,
    nationality: pilot.nationality ?? undefined,
    club: pilot.club ?? undefined,
    civlId: pilot.civlId ?? undefined,
    countryId: pilot.countryId ?? undefined,
  };
}

export function PilotsPage() {
  const activeCompetitionId = useCompetitionId();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Pilot | null>(null);
  const [directoryQ, setDirectoryQ] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<PersonDirectoryEntry | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: pilots, isLoading } = useQuery({
    queryKey: ['pilots', activeCompetitionId, search],
    queryFn: () =>
      api.get<Pilot[]>(`/competitions/${activeCompetitionId}/pilots`, { search, pageSize: 200 }),
    enabled: !!activeCompetitionId,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreatePilotInput>({
    resolver: zodResolver(createPilotSchema),
    defaultValues: { gender: 'MALE', pilotNumber: 1, firstName: '', lastName: '' },
  });

  const gender = watch('gender');

  const { data: directoryHits = [] } = useQuery({
    queryKey: ['people-directory', directoryQ],
    queryFn: () =>
      api.get<PersonDirectoryEntry[]>('/people', { q: directoryQ, pageSize: 8 }),
    enabled: formOpen && !editing && directoryQ.trim().length >= 2,
  });

  const saveMutation = useMutation({
    mutationFn: (data: CreatePilotInput) =>
      editing
        ? api.put<Pilot>(`/competitions/${activeCompetitionId}/pilots/${editing.id}`, data)
        : api.post<Pilot>(`/competitions/${activeCompetitionId}/pilots`, {
            ...data,
            personId: selectedPerson?.id ?? data.personId,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilots'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setFormOpen(false);
      setEditing(null);
      setSelectedPerson(null);
      setDirectoryQ('');
      reset();
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiFetch(`/competitions/${activeCompetitionId}/pilots/import`, {
        method: 'POST',
        formData,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? 'Import failed');
      }
      return response.json() as Promise<{
        success: boolean;
        data?: { imported: number; skipped?: number };
      }>;
    },
    onSuccess: (json) => {
      queryClient.invalidateQueries({ queryKey: ['pilots'] });
      const imported = json.data?.imported ?? 0;
      const skipped = json.data?.skipped ?? 0;
      window.alert(
        skipped > 0
          ? `Imported ${imported} pilot(s). Skipped ${skipped} existing number(s).`
          : `Imported ${imported} pilot(s).`,
      );
    },
  });

  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!activeCompetitionId) return;
    setExportError(null);
    try {
      const response = await apiFetch(`/competitions/${activeCompetitionId}/pilots/export`, {
        method: 'GET',
        params: { format: 'csv' },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? `Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pilots-${activeCompetitionId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const openCreate = () => {
    setEditing(null);
    setSelectedPerson(null);
    setDirectoryQ('');
    saveMutation.reset();
    reset({ gender: 'MALE', pilotNumber: (pilots?.length ?? 0) + 1, firstName: '', lastName: '' });
    setFormOpen(true);
  };

  const openEdit = (pilot: Pilot) => {
    setEditing(pilot);
    setSelectedPerson(null);
    setDirectoryQ('');
    saveMutation.reset();
    reset(toFormValues(pilot));
    setFormOpen(true);
  };

  const selectPerson = (person: PersonDirectoryEntry) => {
    setSelectedPerson(person);
    setDirectoryQ('');
    setValue('personId', person.id);
    setValue('firstName', person.firstName);
    setValue('lastName', person.lastName);
    setValue('gender', person.gender);
    setValue('civlId', person.civlId ?? undefined);
    setValue('faiLicense', person.faiLicenseNumber ?? undefined);
    setValue('nationality', person.nationalityCountry?.code ?? undefined);
    setValue('countryId', person.nationalityCountryId ?? undefined);
  };

  const clearSelectedPerson = () => {
    setSelectedPerson(null);
    setValue('personId', undefined);
  };

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pilots</h1>
          <p className="text-muted-foreground">Registration and pilot roster management</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importMutation.mutate(file);
            }}
          />
          <Button
            variant="outline"
            disabled={importMutation.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {importMutation.isPending ? 'Importing…' : 'Import CSV'}
          </Button>
          <Button variant="outline" onClick={() => void handleExport()}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Pilot
          </Button>
        </div>
      </div>

      {exportError && <p className="text-sm text-destructive">{exportError}</p>}
      {importMutation.isError && (
        <p className="text-sm text-destructive">
          {(importMutation.error as Error)?.message ?? 'Import failed'}
        </p>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, number, country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Club</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : pilots?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No pilots registered yet.
                </TableCell>
              </TableRow>
            ) : (
              pilots?.map((pilot) => (
                <TableRow key={pilot.id}>
                  <TableCell className="font-mono font-medium">{pilot.pilotNumber}</TableCell>
                  <TableCell>
                    {pilot.firstName} {pilot.lastName}
                  </TableCell>
                  <TableCell>{pilot.gender}</TableCell>
                  <TableCell>{pilot.nationality ?? '—'}</TableCell>
                  <TableCell>{pilot.club ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={pilot.status === 'ACTIVE' ? 'success' : 'outline'}>{pilot.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(pilot)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg overflow-visible">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Pilot' : 'Register Pilot'}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((d) => saveMutation.mutate(d))}
            className="grid gap-5 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-5"
          >
            {!editing && (
              <div className="relative z-20 space-y-2 sm:col-span-2">
                <Label>Find returning person</Label>
                <p className="text-xs text-muted-foreground">
                  Search AeroJudge ID, CIVL ID, or name — then enter only competition details.
                </p>
                {selectedPerson ? (
                  <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <UserCheck className="h-4 w-4 shrink-0 text-primary" />
                      <span>
                        {selectedPerson.firstName} {selectedPerson.lastName}
                        {selectedPerson.nationalityCountry
                          ? ` · ${selectedPerson.nationalityCountry.name}`
                          : ''}
                        {selectedPerson.civlId ? ` · CIVL ${selectedPerson.civlId}` : ''}
                        {` · ${selectedPerson.aeroJudgeId}`}
                      </span>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={clearSelectedPerson}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="e.g. 97253 or AJ-… or Pratap"
                      value={directoryQ}
                      onChange={(e) => setDirectoryQ(e.target.value)}
                      autoComplete="off"
                    />
                    {directoryHits.length > 0 && (
                      <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                        {directoryHits.map((p) => (
                          <li key={p.id} className="border-b border-border/40 last:border-0">
                            <button
                              type="button"
                              className="flex w-full flex-col items-start px-3 py-2.5 text-left text-sm hover:bg-muted"
                              onClick={() => selectPerson(p)}
                            >
                              <span className="font-medium">
                                {p.firstName} {p.lastName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {p.aeroJudgeId}
                                {p.civlId ? ` · CIVL ${p.civlId}` : ''}
                                {p.nationalityCountry ? ` · ${p.nationalityCountry.name}` : ''}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label>Pilot Number</Label>
              <Input type="number" {...register('pilotNumber', { valueAsNumber: true })} />
              {errors.pilotNumber && <p className="text-sm text-destructive">{errors.pilotNumber.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={(v) => setValue('gender', v as Gender)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>First Name</Label>
              <Input {...register('firstName')} disabled={!!selectedPerson} />
              {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Last Name</Label>
              <Input {...register('lastName')} disabled={!!selectedPerson} />
              {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label>FAI License</Label>
              <Input {...register('faiLicense')} disabled={!!selectedPerson} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>CIVL ID</Label>
              <Input {...register('civlId')} disabled={!!selectedPerson} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Nationality</Label>
              <Input {...register('nationality')} disabled={!!selectedPerson} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Glider</Label>
              <Input {...register('glider')} />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Club</Label>
              <Input {...register('club')} />
            </div>
            {saveMutation.isError && (
              <p className="sm:col-span-2 text-sm text-destructive">
                {(saveMutation.error as Error)?.message ?? 'Failed to save pilot'}
              </p>
            )}
            <DialogFooter className="mt-1 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {editing ? 'Save' : 'Register'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
