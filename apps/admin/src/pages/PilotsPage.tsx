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
import { Check, Download, ImagePlus, Pencil, Plus, Search, Upload, UserCheck, X } from 'lucide-react';
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
  cn,
} from '@npha/ui';
import { api, apiFetch, apiRequest } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';
import { CountrySelect } from '../components/CountrySelect';

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
  photoUrl?: string | null;
  person?: { id: string; aeroJudgeId: string; civlId?: string | null } | null;
}

const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

async function uploadPilotPhoto(competitionId: string, pilotId: string, file: File): Promise<Pilot> {
  if (file.size > PHOTO_MAX_BYTES) {
    throw new Error('Photo is too large. Maximum size is 2 MB.');
  }
  const formData = new FormData();
  formData.append('photo', file);
  return apiRequest<Pilot>(`/competitions/${competitionId}/pilots/${pilotId}/photo`, {
    method: 'POST',
    formData,
  });
}

async function removePilotPhoto(competitionId: string, pilotId: string): Promise<Pilot> {
  return apiRequest<Pilot>(`/competitions/${competitionId}/pilots/${pilotId}/photo`, {
    method: 'DELETE',
  });
}

type StatusFilter = 'ALL' | 'REGISTERED' | 'CONFIRMED' | 'REJECTED' | 'ACTIVE' | 'OTHER';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'REGISTERED', label: 'Pending' },
  { id: 'CONFIRMED', label: 'Accepted' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'OTHER', label: 'Other' },
];

function statusBadgeVariant(
  status: PilotStatus,
): 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' {
  switch (status) {
    case 'REGISTERED':
      return 'warning';
    case 'CONFIRMED':
    case 'CHECKED_IN':
    case 'ACTIVE':
      return 'success';
    case 'REJECTED':
      return 'destructive';
    case 'WITHDRAWN':
    case 'DISQUALIFIED':
    case 'DNS':
      return 'secondary';
    default:
      return 'outline';
  }
}

function statusLabel(status: PilotStatus): string {
  if (status === 'REGISTERED') return 'PENDING';
  if (status === 'CONFIRMED') return 'ACCEPTED';
  return status.replace(/_/g, ' ');
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Pilot | null>(null);
  const [directoryQ, setDirectoryQ] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<PersonDirectoryEntry | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  /** When true, drop the stored photo on save (edit only). */
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const queryClient = useQueryClient();

  const listStatusParam =
    statusFilter === 'ALL' || statusFilter === 'OTHER' ? undefined : statusFilter;

  const { data: pilots, isLoading } = useQuery({
    queryKey: ['pilots', activeCompetitionId, search, listStatusParam],
    queryFn: () =>
      api.get<Pilot[]>(`/competitions/${activeCompetitionId}/pilots`, {
        search: search || undefined,
        status: listStatusParam,
        pageSize: 200,
      }),
    enabled: !!activeCompetitionId,
  });

  const displayedPilots =
    statusFilter === 'OTHER'
      ? pilots?.filter((p) =>
          ['CHECKED_IN', 'WITHDRAWN', 'DISQUALIFIED', 'DNS'].includes(p.status),
        )
      : pilots;

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
  const countryId = watch('countryId');
  const nationality = watch('nationality');
  const countrySelectValue = countryId || nationality || undefined;

  const { data: directoryHits = [] } = useQuery({
    queryKey: ['people-directory', directoryQ],
    queryFn: () =>
      api.get<PersonDirectoryEntry[]>('/people', { q: directoryQ, pageSize: 8 }),
    enabled: formOpen && !editing && directoryQ.trim().length >= 2,
  });

  const invalidatePilots = () => {
    queryClient.invalidateQueries({ queryKey: ['pilots'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const saveMutation = useMutation({
    mutationFn: async (data: CreatePilotInput) => {
      let pilot = editing
        ? await api.put<Pilot>(`/competitions/${activeCompetitionId}/pilots/${editing.id}`, data)
        : await api.post<Pilot>(`/competitions/${activeCompetitionId}/pilots`, {
            ...data,
            personId: selectedPerson?.id ?? data.personId,
          });

      if (photoFile && activeCompetitionId) {
        try {
          pilot = await uploadPilotPhoto(activeCompetitionId, pilot.id, photoFile);
        } catch {
          // Keep saved pilot if photo upload fails
        }
      } else if (photoRemoved && editing && activeCompetitionId) {
        try {
          pilot = await removePilotPhoto(activeCompetitionId, pilot.id);
        } catch {
          // keep previous photo if remove fails
        }
      }
      return pilot;
    },
    onSuccess: () => {
      invalidatePilots();
      setFormOpen(false);
      setEditing(null);
      setSelectedPerson(null);
      setDirectoryQ('');
      setPhotoFile(null);
      setPhotoPreview(null);
      setPhotoRemoved(false);
      reset();
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ pilotId, action }: { pilotId: string; action: 'accept' | 'reject' }) =>
      api.post<Pilot>(`/competitions/${activeCompetitionId}/pilots/${pilotId}/${action}`),
    onSuccess: () => invalidatePilots(),
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
      invalidatePilots();
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
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoRemoved(false);
    saveMutation.reset();
    reset({ gender: 'MALE', pilotNumber: (pilots?.length ?? 0) + 1, firstName: '', lastName: '' });
    setFormOpen(true);
  };

  const openEdit = (pilot: Pilot) => {
    setEditing(pilot);
    setSelectedPerson(null);
    setDirectoryQ('');
    setPhotoFile(null);
    setPhotoPreview(pilot.photoUrl ?? null);
    setPhotoRemoved(false);
    saveMutation.reset();
    reset(toFormValues(pilot));
    setFormOpen(true);
  };

  const clearPhotoSelection = () => {
    if (photoFile && photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (photoFile) {
      setPhotoPreview(photoRemoved ? null : editing?.photoUrl ?? selectedPerson?.photoUrl ?? null);
      return;
    }
    setPhotoPreview(null);
    setPhotoRemoved(Boolean(editing?.photoUrl));
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
    if (!photoFile) {
      setPhotoPreview(person.photoUrl ?? null);
      setPhotoRemoved(false);
    }
  };

  const clearSelectedPerson = () => {
    setSelectedPerson(null);
    setValue('personId', undefined);
    if (!photoFile) {
      setPhotoPreview(null);
      setPhotoRemoved(false);
    }
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
          <p className="text-muted-foreground">
            Review registrations — accept to seat pilots, or reject applications
          </p>
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
      {statusMutation.isError && (
        <p className="text-sm text-destructive">
          {(statusMutation.error as Error)?.message ?? 'Status update failed'}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, number, country…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                statusFilter === f.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
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
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : !displayedPilots?.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {statusFilter === 'REGISTERED'
                    ? 'No pending registrations.'
                    : 'No pilots match this filter.'}
                </TableCell>
              </TableRow>
            ) : (
              displayedPilots.map((pilot) => {
                const canAccept =
                  pilot.status === 'REGISTERED' || pilot.status === 'REJECTED';
                const canReject =
                  pilot.status === 'REGISTERED' || pilot.status === 'CONFIRMED';
                const busy =
                  statusMutation.isPending && statusMutation.variables?.pilotId === pilot.id;

                return (
                  <TableRow key={pilot.id}>
                    <TableCell className="font-mono font-medium">{pilot.pilotNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {pilot.photoUrl ? (
                          <img
                            src={pilot.photoUrl}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover object-top ring-1 ring-border"
                          />
                        ) : (
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                            {pilot.pilotNumber}
                          </span>
                        )}
                        <span>
                          {pilot.firstName} {pilot.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{pilot.gender}</TableCell>
                    <TableCell>{pilot.nationality ?? '—'}</TableCell>
                    <TableCell>{pilot.club ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(pilot.status)}>
                        {statusLabel(pilot.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {canAccept && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Accept"
                            disabled={busy}
                            onClick={() =>
                              statusMutation.mutate({ pilotId: pilot.id, action: 'accept' })
                            }
                          >
                            <Check className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        {canReject && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Reject"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Reject ${pilot.firstName} ${pilot.lastName}? They will not appear on the public pilot list or flight order.`,
                                )
                              ) {
                                statusMutation.mutate({ pilotId: pilot.id, action: 'reject' });
                              }
                            }}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit"
                          onClick={() => openEdit(pilot)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg sm:p-0">
          <DialogHeader className="shrink-0 space-y-0 border-b bg-background px-4 py-4 pr-12 text-left sm:px-6">
            <DialogTitle>{editing ? 'Edit Pilot' : 'Register Pilot'}</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmit((d) => saveMutation.mutate(d))}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="max-h-[min(calc(90vh-8.5rem),calc(100dvh-8.5rem))] overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
              <div className="grid gap-5 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-5">
                {!editing && (
                  <div className="relative z-10 space-y-2 sm:col-span-2">
                    <Label>Find returning person</Label>
                    <p className="text-xs text-muted-foreground">
                      Search AeroJudge ID, CIVL ID, or name — then enter only competition details.
                    </p>
                    {selectedPerson ? (
                      <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2 text-sm">
                          <UserCheck className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate">
                            {selectedPerson.firstName} {selectedPerson.lastName}
                            {selectedPerson.nationalityCountry
                              ? ` · ${selectedPerson.nationalityCountry.name}`
                              : ''}
                            {selectedPerson.civlId ? ` · CIVL ${selectedPerson.civlId}` : ''}
                            {` · ${selectedPerson.aeroJudgeId}`}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={clearSelectedPerson}
                        >
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
                  {errors.pilotNumber && (
                    <p className="text-sm text-destructive">{errors.pilotNumber.message}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Gender</Label>
                  <Select
                    value={gender}
                    onValueChange={(v) => setValue('gender', v as Gender)}
                    disabled={!!selectedPerson}
                  >
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
                  {errors.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName.message}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Last Name</Label>
                  <Input {...register('lastName')} disabled={!!selectedPerson} />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName.message}</p>
                  )}
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
                  <CountrySelect
                    value={countrySelectValue}
                    disabled={!!selectedPerson}
                    onChange={(country) => {
                      setValue('countryId', country?.id ?? undefined);
                      setValue('nationality', country?.name ?? undefined);
                    }}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Glider</Label>
                  <Input {...register('glider')} />
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label>Club</Label>
                  <Input {...register('club')} />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>Photo</Label>
                  <p className="text-xs text-muted-foreground">
                    {photoFile
                      ? 'Optional headshot for public rankings and venue display (max 2 MB)'
                      : selectedPerson?.photoUrl && photoPreview
                        ? 'Using profile photo from returning person · upload to replace'
                        : 'Optional headshot for public rankings and venue display (max 2 MB)'}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt=""
                        className="h-14 w-14 rounded-full object-cover object-top ring-1 ring-border"
                      />
                    ) : (
                      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <ImagePlus className="h-5 w-5" />
                      </span>
                    )}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        if (photoFile && photoPreview) URL.revokeObjectURL(photoPreview);
                        if (!file) {
                          setPhotoFile(null);
                          setPhotoPreview(
                            photoRemoved
                              ? null
                              : editing?.photoUrl ?? selectedPerson?.photoUrl ?? null,
                          );
                          return;
                        }
                        if (file.size > PHOTO_MAX_BYTES) {
                          window.alert('Photo is too large. Maximum size is 2 MB.');
                          return;
                        }
                        setPhotoRemoved(false);
                        setPhotoFile(file);
                        setPhotoPreview(URL.createObjectURL(file));
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      <ImagePlus className="mr-2 h-4 w-4" />
                      {photoPreview ? 'Change photo' : 'Add photo'}
                    </Button>
                    {photoPreview && (photoFile || editing) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={clearPhotoSelection}
                      >
                        <X className="mr-2 h-4 w-4" />
                        {photoFile ? 'Clear new selection' : 'Remove'}
                      </Button>
                    )}
                  </div>
                </div>

                {saveMutation.isError && (
                  <p className="sm:col-span-2 text-sm text-destructive">
                    {(saveMutation.error as Error)?.message ?? 'Failed to save pilot'}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="relative z-10 shrink-0 border-t bg-background px-4 py-4 sm:px-6">
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
