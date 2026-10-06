import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Gender,
  PersonCompetitionHistoryItem,
  PersonDirectoryEntry,
  PersonRecord,
} from '@aero-judge/shared';
import { formatPilotName } from '@aero-judge/utils';
import { z } from 'zod';
import { Pencil, Search, Shield, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
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
} from '@aero-judge/ui';
import { api, ApiError, type ApiPage } from '../lib/api';
import { usePermission } from '../hooks/usePermission';
import { PageHeader } from '../components/PageHeader';
import { CountrySelect } from '../components/CountrySelect';
import { competitionPath } from '../hooks/useCompetitionId';

type PersonStatusFilter = 'ACTIVE' | 'ARCHIVED' | 'MERGED' | 'ALL';
type GenderFilter = Gender | 'ALL';
type Visibility = 'PRIVATE' | 'ORGANIZATIONS_ONLY' | 'PUBLIC';

const PAGE_SIZE = 25;

const STATUS_FILTERS: { id: PersonStatusFilter; label: string }[] = [
  { id: 'ACTIVE', label: 'Active' },
  { id: 'ARCHIVED', label: 'Archived' },
  { id: 'MERGED', label: 'Merged' },
  { id: 'ALL', label: 'All' },
];

const directoryFormSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  middleName: z.string().max(100),
  preferredName: z.string().max(100),
  displayName: z.string().max(100),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  dateOfBirth: z.string(),
  nationalityCountryId: z.string(),
  civlId: z.string().max(100),
  faiLicenseNumber: z.string().max(100),
  faiLicenseExpiry: z.string(),
  email: z.union([z.string().email('Enter a valid email'), z.literal('')]),
  phone: z.string().max(40),
  visibility: z.enum(['PRIVATE', 'ORGANIZATIONS_ONLY', 'PUBLIC']),
});

type DirectoryFormValues = z.infer<typeof directoryFormSchema>;

const EMPTY_FORM: DirectoryFormValues = {
  firstName: '',
  lastName: '',
  middleName: '',
  preferredName: '',
  displayName: '',
  gender: 'MALE',
  dateOfBirth: '',
  nationalityCountryId: '',
  civlId: '',
  faiLicenseNumber: '',
  faiLicenseExpiry: '',
  email: '',
  phone: '',
  visibility: 'PRIVATE',
};

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function dateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '';
}

function visibilityOf(value: string | undefined): Visibility {
  if (value === 'PUBLIC' || value === 'ORGANIZATIONS_ONLY' || value === 'PRIVATE') return value;
  return 'PRIVATE';
}

function personToForm(person: PersonRecord): DirectoryFormValues {
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    middleName: person.middleName ?? '',
    preferredName: person.preferredName ?? '',
    displayName: person.displayName ?? '',
    gender: person.gender,
    dateOfBirth: dateInputValue(person.dateOfBirth),
    nationalityCountryId: person.nationalityCountryId ?? '',
    civlId: person.civlId ?? '',
    faiLicenseNumber: person.faiLicenseNumber ?? '',
    faiLicenseExpiry: dateInputValue(person.faiLicenseExpiry),
    email: person.email ?? '',
    phone: person.phone ?? '',
    visibility: visibilityOf(person.visibility),
  };
}

function toPayload(values: DirectoryFormValues) {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    middleName: emptyToNull(values.middleName),
    preferredName: emptyToNull(values.preferredName),
    displayName: emptyToNull(values.displayName),
    gender: values.gender,
    dateOfBirth: values.dateOfBirth || null,
    nationalityCountryId: values.nationalityCountryId || null,
    civlId: emptyToNull(values.civlId),
    faiLicenseNumber: emptyToNull(values.faiLicenseNumber),
    faiLicenseExpiry: values.faiLicenseExpiry || null,
    email: values.email.trim() ? values.email.trim().toLowerCase() : null,
    phone: emptyToNull(values.phone),
    visibility: values.visibility,
  };
}

function genderLabel(gender: Gender): string {
  if (gender === 'FEMALE') return 'Female';
  if (gender === 'OTHER') return 'Other';
  return 'Male';
}

function statusVariant(
  status: string | undefined,
): 'success' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'ARCHIVED') return 'secondary';
  if (status === 'MERGED') return 'outline';
  return 'secondary';
}

function PilotIdentity({ person }: { person: PersonDirectoryEntry }) {
  const name = formatPilotName(person.firstName, person.lastName);
  return (
    <div className="flex min-w-0 items-center gap-3">
      {person.photoUrl ? (
        <img
          src={person.photoUrl}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {(person.firstName.charAt(0) + person.lastName.charAt(0)).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {person.aeroJudgeId}
          {person.preferredName ? ` · ${person.preferredName}` : ''}
        </p>
      </div>
    </div>
  );
}

/**
 * Workspace directory of pilots loaded in AeroJudge.
 * Search, filter, and update the global person record. Competition snapshots stay as recorded.
 */
export function PilotDirectoryPage() {
  const canManage = usePermission('pilot:manage');
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PersonStatusFilter>('ACTIVE');
  const [gender, setGender] = useState<GenderFilter>('ALL');
  const [countryId, setCountryId] = useState('');
  const [pilotsOnly, setPilotsOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const loadedId = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, status, gender, countryId, pilotsOnly]);

  const listQuery = useQuery({
    queryKey: ['pilot-directory', { search, status, gender, countryId, pilotsOnly, page }],
    queryFn: () =>
      api.getPage<PersonDirectoryEntry[]>('/people', {
        q: search || undefined,
        status,
        gender: gender === 'ALL' ? undefined : gender,
        nationalityCountryId: countryId || undefined,
        pilotsOnly,
        includeContact: true,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: canManage,
  });

  const personQuery = useQuery({
    queryKey: ['pilot-directory', 'person', editingId],
    queryFn: () => api.get<PersonRecord>(`/people/${editingId}`),
    enabled: !!editingId,
  });

  const historyQuery = useQuery({
    queryKey: ['pilot-directory', 'history', editingId],
    queryFn: () => api.get<PersonCompetitionHistoryItem[]>(`/people/${editingId}/history`),
    enabled: !!editingId,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DirectoryFormValues>({
    resolver: zodResolver(directoryFormSchema),
    defaultValues: EMPTY_FORM,
  });

  const formGender = watch('gender');
  const formVisibility = watch('visibility');
  const formCountryId = watch('nationalityCountryId');

  useEffect(() => {
    const person = personQuery.data;
    if (!person || loadedId.current === person.id) return;
    loadedId.current = person.id;
    reset(personToForm(person));
  }, [personQuery.data, reset]);

  const saveMutation = useMutation({
    mutationFn: (values: DirectoryFormValues) => {
      if (!editingId) throw new Error('No pilot selected');
      return api.patch<PersonRecord>(`/people/${editingId}`, toPayload(values));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pilot-directory'] });
      await queryClient.invalidateQueries({ queryKey: ['people-directory'] });
      closeEditor();
    },
    onError: (err) => {
      setSaveError(err instanceof ApiError ? err.message : 'Could not save pilot');
    },
  });

  const closeEditor = () => {
    setEditingId(null);
    setSaveError(null);
    loadedId.current = null;
    saveMutation.reset();
    reset(EMPTY_FORM);
  };

  const openEditor = (person: PersonDirectoryEntry) => {
    if (person.status === 'MERGED') return;
    setSaveError(null);
    loadedId.current = null;
    saveMutation.reset();
    setEditingId(person.id);
  };

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Shield className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Access restricted</h2>
        <p className="text-muted-foreground">You do not have permission to manage pilots.</p>
      </div>
    );
  }

  const pageResult: ApiPage<PersonDirectoryEntry[]> | undefined = listQuery.data;
  const pilots = pageResult?.data ?? [];
  const total = pageResult?.meta?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const noun = pilotsOnly ? 'pilots' : 'people';
  const listError =
    listQuery.error instanceof Error ? listQuery.error.message : 'Could not load pilots';

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Pilots"
        description="Everyone loaded in the pilot directory. Search, filter, and update identity details. Competition entries keep the name recorded for that event."
      />

      <div className="flex flex-col gap-3">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9 sm:h-10"
            placeholder="Search name, AeroJudge ID, CIVL, FAI, or email"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search pilots"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: true, label: 'Pilots' },
                { id: false, label: 'All people' },
              ] as const
            ).map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => {
                  setPilotsOnly(option.id);
                  setPage(1);
                }}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                  pilotsOnly === option.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => {
                  setStatus(filter.id);
                  setPage(1);
                }}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                  status === filter.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted',
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={gender}
            onValueChange={(value) => {
              setGender(value as GenderFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by gender">
              <SelectValue placeholder="Gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All genders</SelectItem>
              <SelectItem value="MALE">Male</SelectItem>
              <SelectItem value="FEMALE">Female</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
          <div className="w-full sm:w-64">
            <CountrySelect
              value={countryId || null}
              onChange={(country) => {
                setCountryId(country?.id ?? '');
                setPage(1);
              }}
              placeholder="All countries"
            />
          </div>
        </div>
      </div>

      {listQuery.isError && (
        <p className="text-sm text-destructive" role="alert">
          {listError}
        </p>
      )}

      <div className="space-y-3 md:hidden">
        {listQuery.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading pilots…</p>
        ) : pilots.length === 0 ? (
          <EmptyPilots noun={noun} />
        ) : (
          pilots.map((person) => (
            <Card key={person.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 space-y-2">
                  <PilotIdentity person={person} />
                  <p className="text-xs text-muted-foreground">
                    {person.nationalityCountry?.name ?? 'No country'}
                    {' · '}
                    {genderLabel(person.gender)}
                    {' · '}
                    {person.pilotCount ?? 0} {person.pilotCount === 1 ? 'event' : 'events'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {person.civlId ? `CIVL ${person.civlId}` : 'No CIVL ID'}
                    {person.email ? ` · ${person.email}` : ''}
                  </p>
                  {status !== 'ACTIVE' && (
                    <Badge variant={statusVariant(person.status)}>{person.status ?? 'ACTIVE'}</Badge>
                  )}
                </div>
                <EditButton person={person} onEdit={openEditor} />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>CIVL / FAI</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead className="hidden lg:table-cell">Email</TableHead>
              <TableHead>Events</TableHead>
              {status !== 'ACTIVE' && <TableHead>Status</TableHead>}
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={status === 'ACTIVE' ? 7 : 8} className="text-center text-muted-foreground">
                  Loading pilots…
                </TableCell>
              </TableRow>
            ) : pilots.length === 0 ? (
              <TableRow>
                <TableCell colSpan={status === 'ACTIVE' ? 7 : 8}>
                  <EmptyPilots noun={noun} />
                </TableCell>
              </TableRow>
            ) : (
              pilots.map((person) => (
                <TableRow key={person.id}>
                  <TableCell>
                    <PilotIdentity person={person} />
                  </TableCell>
                  <TableCell>{person.nationalityCountry?.name ?? '—'}</TableCell>
                  <TableCell>
                    <div className="text-sm">{person.civlId ?? '—'}</div>
                    {person.faiLicenseNumber && (
                      <div className="text-xs text-muted-foreground">{person.faiLicenseNumber}</div>
                    )}
                  </TableCell>
                  <TableCell>{genderLabel(person.gender)}</TableCell>
                  <TableCell className="hidden max-w-[14rem] truncate lg:table-cell">
                    {person.email ?? '—'}
                  </TableCell>
                  <TableCell>{person.pilotCount ?? 0}</TableCell>
                  {status !== 'ACTIVE' && (
                    <TableCell>
                      <Badge variant={statusVariant(person.status)}>{person.status ?? 'ACTIVE'}</Badge>
                    </TableCell>
                  )}
                  <TableCell>
                    <EditButton person={person} onEdit={openEditor} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {listQuery.isLoading ? 'Loading…' : total === 0 ? `0 ${noun}` : `${from}–${to} of ${total} ${noun}`}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 1 || listQuery.isLoading} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={listQuery.isLoading || to >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog
        open={!!editingId}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl sm:p-0">
          <DialogHeader className="shrink-0 space-y-1 border-b bg-background px-4 py-4 pr-12 text-left sm:px-6">
            <DialogTitle>Update pilot</DialogTitle>
            <DialogDescription>
              {personQuery.data
                ? `${formatPilotName(personQuery.data.firstName, personQuery.data.lastName)} · ${personQuery.data.aeroJudgeId}`
                : 'Loading profile…'}
              {personQuery.data?.linkedUser
                ? ` · Login ${personQuery.data.linkedUser.email}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmit((values) => {
              setSaveError(null);
              saveMutation.mutate(values);
            })}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="max-h-[min(calc(90vh-8.5rem),calc(100dvh-8.5rem))] overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
              {personQuery.isLoading && (
                <p className="text-sm text-muted-foreground">Loading profile…</p>
              )}
              {personQuery.isError && (
                <p className="text-sm text-destructive" role="alert">
                  {personQuery.error instanceof Error
                    ? personQuery.error.message
                    : 'Could not load this pilot'}
                </p>
              )}
              {personQuery.data && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name" error={errors.firstName?.message}>
                    <Input {...register('firstName')} />
                  </Field>
                  <Field label="Last name" error={errors.lastName?.message}>
                    <Input {...register('lastName')} />
                  </Field>
                  <Field label="Middle name">
                    <Input {...register('middleName')} />
                  </Field>
                  <Field label="Preferred name">
                    <Input {...register('preferredName')} />
                  </Field>
                  <Field label="Display name">
                    <Input {...register('displayName')} />
                  </Field>
                  <Field label="Gender">
                    <Select
                      value={formGender}
                      onValueChange={(value) => setValue('gender', value as Gender, { shouldDirty: true })}
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
                  </Field>
                  <Field label="Date of birth">
                    <Input type="date" {...register('dateOfBirth')} />
                  </Field>
                  <Field label="Country">
                    <CountrySelect
                      value={formCountryId || null}
                      onChange={(country) =>
                        setValue('nationalityCountryId', country?.id ?? '', { shouldDirty: true })
                      }
                      placeholder="Select country"
                    />
                  </Field>
                  <Field label="CIVL ID">
                    <Input {...register('civlId')} />
                  </Field>
                  <Field label="FAI license">
                    <Input {...register('faiLicenseNumber')} />
                  </Field>
                  <Field label="FAI license expiry">
                    <Input type="date" {...register('faiLicenseExpiry')} />
                  </Field>
                  <Field label="Email" error={errors.email?.message}>
                    <Input type="email" autoComplete="off" {...register('email')} />
                  </Field>
                  <Field label="Phone">
                    <Input {...register('phone')} />
                  </Field>
                  <Field label="Profile visibility">
                    <Select
                      value={formVisibility}
                      onValueChange={(value) =>
                        setValue('visibility', value as Visibility, { shouldDirty: true })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRIVATE">Private</SelectItem>
                        <SelectItem value="ORGANIZATIONS_ONLY">Organizations</SelectItem>
                        <SelectItem value="PUBLIC">Public</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <div className="space-y-2 sm:col-span-2">
                    <p className="text-sm font-medium">Competition entries</p>
                    {historyQuery.isLoading && (
                      <p className="text-sm text-muted-foreground">Loading entries…</p>
                    )}
                    {historyQuery.isError && (
                      <p className="text-sm text-destructive">Could not load competition entries.</p>
                    )}
                    {historyQuery.data && historyQuery.data.length === 0 && (
                      <p className="text-sm text-muted-foreground">No competition entries yet.</p>
                    )}
                    {historyQuery.data && historyQuery.data.length > 0 && (
                      <ul className="divide-y rounded-md border">
                        {historyQuery.data.map((entry) => (
                          <li key={entry.id} className="px-3 py-2 text-sm">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <Link
                                to={competitionPath(
                                  entry.competition.organizationId,
                                  entry.competition.id,
                                  'pilots',
                                )}
                                className="font-medium text-primary hover:underline"
                              >
                                {entry.competition.name}
                              </Link>
                              <span className="text-xs text-muted-foreground">
                                {entry.competition.startDate.slice(0, 4)} · {entry.competition.country}
                              </span>
                            </div>
                            {entry.pilotSnapshot && (
                              <p className="text-xs text-muted-foreground">
                                #{entry.pilotSnapshot.pilotNumber} ·{' '}
                                {entry.pilotSnapshot.status.replace(/_/g, ' ')}
                                {entry.pilotSnapshot.glider ? ` · ${entry.pilotSnapshot.glider}` : ''}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {saveError && (
                    <p className="text-sm text-destructive sm:col-span-2" role="alert">
                      {saveError}
                    </p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="relative z-10 shrink-0 border-t bg-background px-4 py-4 sm:px-6">
              <Button type="button" variant="outline" onClick={closeEditor}>
                Cancel
              </Button>
              <Button type="submit" disabled={!personQuery.data || saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function EditButton({
  person,
  onEdit,
}: {
  person: PersonDirectoryEntry;
  onEdit: (person: PersonDirectoryEntry) => void;
}) {
  const merged = person.status === 'MERGED';
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={merged}
      title={merged ? 'Merged profiles stay on the canonical record' : 'Update pilot'}
      aria-label={`Update ${formatPilotName(person.firstName, person.lastName)}`}
      onClick={() => onEdit(person)}
    >
      <Pencil className="h-4 w-4" />
    </Button>
  );
}

function EmptyPilots({ noun }: { noun: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <Users className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">No {noun} match these filters.</p>
    </div>
  );
}
