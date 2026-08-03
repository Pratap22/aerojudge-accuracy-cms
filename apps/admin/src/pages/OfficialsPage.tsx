import { useEffect, useRef, useState } from 'react';
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
import {
  Eye,
  EyeOff,
  Gavel,
  ImagePlus,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from '@npha/ui';
import { api, apiRequest } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';

const ROLE_CUSTOM = '__custom__';
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

async function uploadOfficialPhoto(
  competitionId: string,
  officialId: string,
  file: File,
): Promise<CompetitionOfficial> {
  if (file.size > PHOTO_MAX_BYTES) {
    throw new Error('Photo is too large. Maximum size is 5 MB.');
  }
  const formData = new FormData();
  formData.append('photo', file);
  return apiRequest<CompetitionOfficial>(
    `/competitions/${competitionId}/officials/${officialId}/photo`,
    { method: 'POST', formData },
  );
}

function Avatar({
  name,
  imageUrl,
  size = 'md',
}: {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dim = size === 'lg' ? 'h-20 w-20 text-lg' : size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm';
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={cn('shrink-0 rounded-full object-cover object-top ring-1 ring-border', dim)}
      />
    );
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ring-1 ring-border',
        dim,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function OfficialsPage() {
  const competitionId = useCompetitionId();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CompetitionOfficial | null>(null);
  const [roleMode, setRoleMode] = useState<string>('Judge');
  const [directoryQ, setDirectoryQ] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<PersonDirectoryEntry | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

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
  const nameValue = watch('name');

  useEffect(() => {
    if (!photoFile) return undefined;
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['officials', competitionId] });
  };

  const resetPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoError(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setSelectedPerson(null);
    setDirectoryQ('');
    resetPhoto();
    reset({ name: '', role: 'Judge', isPublic: true });
    setRoleMode('Judge');
  };

  const saveMutation = useMutation({
    mutationFn: async (data: CreateOfficialInput) => {
      if (photoFile && photoFile.size > PHOTO_MAX_BYTES) {
        throw new Error('Photo is too large. Maximum size is 5 MB.');
      }

      let official: CompetitionOfficial;
      if (editing) {
        official = await api.patch<CompetitionOfficial>(
          `/competitions/${competitionId}/officials/${editing.id}`,
          data,
        );
      } else {
        official = await api.post<CompetitionOfficial>(
          `/competitions/${competitionId}/officials`,
          {
            ...data,
            personId: selectedPerson?.id ?? data.personId,
            name:
              data.name ||
              (selectedPerson
                ? `${selectedPerson.firstName} ${selectedPerson.lastName}`.trim()
                : undefined),
          },
        );
      }

      if (photoFile) {
        official = await uploadOfficialPhoto(competitionId!, official.id, photoFile);
      }
      return official;
    },
    onSuccess: () => {
      invalidate();
      closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/competitions/${competitionId}/officials/${id}`),
    onSuccess: invalidate,
  });

  const openCreate = () => {
    setEditing(null);
    setSelectedPerson(null);
    setDirectoryQ('');
    resetPhoto();
    reset({ name: '', role: 'Judge', phone: undefined, email: undefined, isPublic: true });
    setRoleMode('Judge');
    setFormOpen(true);
  };

  const openEdit = (official: CompetitionOfficial) => {
    setEditing(official);
    setSelectedPerson(null);
    setDirectoryQ('');
    resetPhoto();
    setPhotoPreview(official.imageUrl ?? null);
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
    if (!photoFile && person.photoUrl) {
      setPhotoPreview(person.photoUrl);
    }
  };

  const clearSelectedPerson = () => {
    setSelectedPerson(null);
    setValue('personId', undefined);
  };

  const onPhotoSelected = (file: File | undefined) => {
    setPhotoError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Choose an image file (PNG, JPEG, WebP, or GIF).');
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setPhotoError('Photo is too large. Maximum size is 5 MB.');
      return;
    }
    setPhotoFile(file);
  };

  const onSubmit = handleSubmit((data) => {
    setPhotoError(null);
    saveMutation.mutate(data);
  });

  const formPreviewUrl = photoPreview;
  const formPreviewName = nameValue?.trim() || editing?.name || 'Official';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight">Officials &amp; judges</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage event staff shown on the public results site. Add or change photos in the form when
            creating or editing.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add official
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border">
          <div className="space-y-0 divide-y">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="h-11 w-11 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : officials.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Gavel className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-base">No officials yet</CardTitle>
            <CardDescription className="max-w-sm">
              Add the chief judge, meet director, and other event officials for the public pages.
            </CardDescription>
            <div className="pt-4">
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add official
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[44%]">Official</TableHead>
                <TableHead className="hidden sm:table-cell">Contact</TableHead>
                <TableHead className="w-[100px]">Visibility</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {officials.map((official) => (
                <TableRow key={official.id} className="group">
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => openEdit(official)}
                      className="flex w-full min-w-0 items-center gap-3 text-left"
                    >
                      <Avatar name={official.name} imageUrl={official.imageUrl} />
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-tight">{official.name}</p>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {official.role}
                        </p>
                      </div>
                    </button>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="space-y-0.5 text-sm text-muted-foreground">
                      {official.email ? (
                        <p className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          <span className="truncate">{official.email}</span>
                        </p>
                      ) : null}
                      {official.phone ? (
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          <span className="truncate">{official.phone}</span>
                        </p>
                      ) : null}
                      {!official.email && !official.phone ? (
                        <span className="text-xs">—</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {official.isPublic ? (
                      <Badge variant="success" className="gap-1 font-normal">
                        <Eye className="h-3 w-3" />
                        Public
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 font-normal">
                        <EyeOff className="h-3 w-3" />
                        Hidden
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center justify-end gap-0.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Edit"
                        onClick={() => openEdit(official)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Delete"
                        onClick={() => {
                          if (window.confirm(`Delete ${official.name}?`)) {
                            deleteMutation.mutate(official.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) closeForm();
          else setFormOpen(true);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-visible sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit official' : 'Add official'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-5">
            {/* Photo only lives in this form — not on the list cards */}
            <div className="space-y-2">
              <Label>Photo</Label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  onPhotoSelected(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className={cn(
                  'flex w-full items-center gap-4 rounded-lg border border-dashed p-4 text-left transition-colors',
                  'hover:border-primary/50 hover:bg-muted/40',
                  photoFile && 'border-primary/40 bg-primary/5',
                )}
              >
                <Avatar name={formPreviewName} imageUrl={formPreviewUrl} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <ImagePlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {formPreviewUrl ? 'Change photo' : 'Upload photo'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PNG, JPEG, WebP, or GIF · max 5 MB · applied when you save
                  </p>
                  {photoFile ? (
                    <p className="mt-1 truncate text-xs text-primary">{photoFile.name}</p>
                  ) : null}
                </div>
              </button>
              {photoFile ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoError(null);
                    if (photoInputRef.current) photoInputRef.current.value = '';
                    setPhotoPreview(editing?.imageUrl ?? null);
                  }}
                >
                  Clear new selection
                </Button>
              ) : null}
              {(photoError || saveMutation.isError) && (
                <p className="text-sm text-destructive">
                  {photoError ??
                    (saveMutation.error instanceof Error
                      ? saveMutation.error.message
                      : 'Failed to save official')}
                </p>
              )}
            </div>

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
                <Input {...register('role')} placeholder="Custom role title" className="mt-2" />
              )}
              {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending
                  ? photoFile
                    ? 'Saving & uploading…'
                    : 'Saving…'
                  : editing
                    ? 'Save'
                    : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
