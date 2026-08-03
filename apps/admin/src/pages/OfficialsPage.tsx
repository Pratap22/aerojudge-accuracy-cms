import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  OFFICIAL_ROLE_OPTIONS,
  createOfficialSchema,
  type CompetitionOfficial,
  type CreateOfficialInput,
  type PersonDirectoryEntry,
} from '@npha/shared';
import { Gavel, Pencil, Plus, Trash2, Upload, UserCheck, X } from 'lucide-react';
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
import { api, apiRequest } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';

const ROLE_CUSTOM = '__custom__';

export function OfficialsPage() {
  const competitionId = useCompetitionId();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CompetitionOfficial | null>(null);
  const [roleMode, setRoleMode] = useState<string>('Judge');
  const [directoryQ, setDirectoryQ] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<PersonDirectoryEntry | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  const { data: officials = [], isLoading } = useQuery({
    queryKey: ['officials', competitionId],
    queryFn: () => api.get<CompetitionOfficial[]>(`/competitions/${competitionId}/officials`),
    enabled: !!competitionId,
  });

  const { data: directoryHits = [] } = useQuery({
    queryKey: ['people-directory-officials', directoryQ],
    queryFn: () =>
      api.get<PersonDirectoryEntry[]>('/people', { q: directoryQ, pageSize: 8 }),
    enabled: formOpen && !editing && directoryQ.trim().length >= 2,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateOfficialInput>({
    resolver: zodResolver(createOfficialSchema),
    defaultValues: {
      name: '',
      role: 'Judge',
      phone: undefined,
      email: undefined,
      isPublic: true,
    },
  });

  const isPublic = watch('isPublic');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['officials', competitionId] });
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateOfficialInput) =>
      api.post<CompetitionOfficial>(`/competitions/${competitionId}/officials`, {
        ...data,
        personId: selectedPerson?.id ?? data.personId,
        name:
          data.name ||
          (selectedPerson
            ? `${selectedPerson.firstName} ${selectedPerson.lastName}`.trim()
            : undefined),
      }),
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      setSelectedPerson(null);
      setDirectoryQ('');
      reset({ name: '', role: 'Judge', isPublic: true });
      setRoleMode('Judge');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateOfficialInput }) =>
      api.patch<CompetitionOfficial>(`/competitions/${competitionId}/officials/${id}`, data),
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      setEditing(null);
      reset({ name: '', role: 'Judge', isPublic: true });
      setRoleMode('Judge');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/competitions/${competitionId}/officials/${id}`),
    onSuccess: invalidate,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const maxBytes = 5 * 1024 * 1024;
      if (file.size > maxBytes) {
        throw new Error('Photo is too large. Maximum size is 5 MB.');
      }
      const formData = new FormData();
      formData.append('photo', file);
      return apiRequest<CompetitionOfficial>(
        `/competitions/${competitionId}/officials/${id}/photo`,
        { method: 'POST', formData },
      );
    },
    onSuccess: () => {
      invalidate();
      setUploadTargetId(null);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setSelectedPerson(null);
    setDirectoryQ('');
    reset({ name: '', role: 'Judge', phone: undefined, email: undefined, isPublic: true });
    setRoleMode('Judge');
    setFormOpen(true);
  };

  const openEdit = (official: CompetitionOfficial) => {
    setEditing(official);
    setSelectedPerson(null);
    setDirectoryQ('');
    const preset = OFFICIAL_ROLE_OPTIONS.includes(
      official.role as (typeof OFFICIAL_ROLE_OPTIONS)[number],
    )
      ? official.role
      : ROLE_CUSTOM;
    setRoleMode(preset);
    reset({
      name: official.name,
      role: official.role,
      phone: official.phone ?? undefined,
      email: official.email ?? undefined,
      isPublic: official.isPublic,
    });
    setFormOpen(true);
  };

  const selectPerson = (person: PersonDirectoryEntry) => {
    setSelectedPerson(person);
    setDirectoryQ('');
    setValue('personId', person.id);
    setValue('name', `${person.firstName} ${person.lastName}`.trim());
  };

  const clearSelectedPerson = () => {
    setSelectedPerson(null);
    setValue('personId', undefined);
  };

  const onSubmit = handleSubmit((data) => {
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Officials &amp; judges</h1>
          <p className="text-muted-foreground">
            Public-facing staff for this event. Entries marked public appear on the results site
            with name, role, photo, phone, and email.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add official
        </Button>
      </div>

      {uploadMutation.isError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {uploadMutation.error instanceof Error
            ? uploadMutation.error.message
            : 'Photo upload failed'}
        </p>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading officials…</p>
      ) : officials.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gavel className="h-5 w-5" />
              No officials yet
            </CardTitle>
            <CardDescription>
              Add the chief judge, meet director, and other event officials for the public pages.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {officials.map((official) => (
            <Card key={official.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{official.name}</CardTitle>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="secondary">{official.role}</Badge>
                      {!official.isPublic && <Badge variant="outline">Hidden</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setUploadTargetId(official.id);
                        fileRef.current?.click();
                      }}
                      title="Upload photo (Cloudinary)"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(official)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(`Delete ${official.name}?`)) {
                          deleteMutation.mutate(official.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex h-36 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                  {official.imageUrl ? (
                    <img
                      src={official.imageUrl}
                      alt={official.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">No photo</span>
                  )}
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {official.email && <p className="truncate">{official.email}</p>}
                  {official.phone && <p>{official.phone}</p>}
                  {!official.email && !official.phone && (
                    <p className="text-xs">No contact details</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadTargetId) {
            uploadMutation.mutate({ id: uploadTargetId, file });
          }
          e.target.value = '';
        }}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="overflow-visible">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit official' : 'Add official'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-5">
            {!editing && (
              <div className="relative z-20 space-y-2">
                <Label>Find returning person</Label>
                {selectedPerson ? (
                  <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 shrink-0 text-primary" />
                      {selectedPerson.firstName} {selectedPerson.lastName} ·{' '}
                      {selectedPerson.aeroJudgeId}
                    </span>
                    <Button type="button" variant="ghost" size="icon" onClick={clearSelectedPerson}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Name, CIVL ID, or AeroJudge ID"
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
                              className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted"
                              onClick={() => selectPerson(p)}
                            >
                              {p.firstName} {p.lastName} · {p.aeroJudgeId}
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
              <Label htmlFor="official-name">Name</Label>
              <Input
                id="official-name"
                {...register('name')}
                placeholder="Full name"
                disabled={!!selectedPerson}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <Select
                value={roleMode}
                onValueChange={(v) => {
                  setRoleMode(v);
                  if (v !== ROLE_CUSTOM) {
                    setValue('role', v, { shouldValidate: true });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {OFFICIAL_ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                  <SelectItem value={ROLE_CUSTOM}>Custom…</SelectItem>
                </SelectContent>
              </Select>
              {roleMode === ROLE_CUSTOM && (
                <Input
                  {...register('role')}
                  placeholder="Custom role title"
                  className="mt-2"
                />
              )}
              {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="official-phone">Phone (optional)</Label>
              <Input id="official-phone" {...register('phone')} placeholder="+1 …" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="official-email">Email (optional)</Label>
              <Input
                id="official-email"
                type="email"
                {...register('email')}
                placeholder="name@example.com"
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="rounded"
                checked={isPublic ?? true}
                onChange={(e) => setValue('isPublic', e.target.checked)}
              />
              Show on public results site
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editing ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
