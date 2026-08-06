import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PARTNER_LABEL_OPTIONS,
  SPONSOR_TYPES,
  createSponsorSchema,
  type CompetitionSponsor,
  type CreateSponsorInput,
  type SponsorType,
} from '@npha/shared';
import { Handshake, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react';
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

const TYPE_LABELS: Record<SponsorType, string> = {
  TITLE: 'Title',
  PRESENTING: 'Presenting',
  GOLD: 'Gold',
  SILVER: 'Silver',
  BRONZE: 'Bronze',
  STANDARD: 'Standard',
};

const LOGO_MAX_BYTES = 5 * 1024 * 1024;

interface CompetitionWithPartners {
  id: string;
  settings?: {
    partnersLabel?: string;
    partnerTiersEnabled?: boolean;
  } | null;
}

function singularLabel(label: string): string {
  if (label.toLowerCase().endsWith('s') && label.length > 1) {
    return label.slice(0, -1);
  }
  return label;
}

async function uploadSponsorLogo(
  competitionId: string,
  sponsorId: string,
  file: File,
): Promise<CompetitionSponsor> {
  if (file.size > LOGO_MAX_BYTES) {
    throw new Error('Logo is too large. Maximum size is 5 MB.');
  }
  const formData = new FormData();
  formData.append('logo', file);
  return apiRequest<CompetitionSponsor>(`/competitions/${competitionId}/sponsors/${sponsorId}/logo`, {
    method: 'POST',
    formData,
  });
}

export function SponsorsPage() {
  const competitionId = useCompetitionId();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CompetitionSponsor | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  const { data: competition } = useQuery({
    queryKey: ['competition', competitionId],
    queryFn: () => api.get<CompetitionWithPartners>(`/competitions/${competitionId}`),
    enabled: !!competitionId,
  });

  const partnersLabel = competition?.settings?.partnersLabel?.trim() || 'Sponsors';
  const tiersEnabled = competition?.settings?.partnerTiersEnabled ?? true;
  const singular = singularLabel(partnersLabel);

  const { data: sponsors = [], isLoading } = useQuery({
    queryKey: ['sponsors', competitionId],
    queryFn: () => api.get<CompetitionSponsor[]>(`/competitions/${competitionId}/sponsors`),
    enabled: !!competitionId,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateSponsorInput>({
    resolver: zodResolver(createSponsorSchema),
    defaultValues: { name: '', type: tiersEnabled ? 'STANDARD' : null, websiteUrl: undefined },
  });

  const selectedType = watch('type');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['sponsors', competitionId] });
    queryClient.invalidateQueries({ queryKey: ['competition', competitionId] });
  };

  const resetLogoState = () => {
    if (logoFile && logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    setLogoError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const partnersSettingsMutation = useMutation({
    mutationFn: (data: { partnersLabel: string; partnerTiersEnabled: boolean }) =>
      api.put(`/competitions/${competitionId}/settings`, data),
    onSuccess: invalidate,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: CreateSponsorInput) => {
      if (!competitionId) throw new Error('No competition selected');
      let sponsor = editing
        ? await api.patch<CompetitionSponsor>(
            `/competitions/${competitionId}/sponsors/${editing.id}`,
            data,
          )
        : await api.post<CompetitionSponsor>(`/competitions/${competitionId}/sponsors`, data);

      if (logoFile) {
        sponsor = await uploadSponsorLogo(competitionId, sponsor.id, logoFile);
      }
      return sponsor;
    },
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      setEditing(null);
      resetLogoState();
      reset({ name: '', type: tiersEnabled ? 'STANDARD' : null });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/competitions/${competitionId}/sponsors/${id}`),
    onSuccess: invalidate,
  });

  const openCreate = () => {
    setEditing(null);
    resetLogoState();
    saveMutation.reset();
    reset({ name: '', type: tiersEnabled ? 'STANDARD' : null, websiteUrl: undefined });
    setFormOpen(true);
  };

  const openEdit = (sponsor: CompetitionSponsor) => {
    setEditing(sponsor);
    resetLogoState();
    setLogoPreview(sponsor.logoUrl ?? null);
    saveMutation.reset();
    const type =
      sponsor.type && SPONSOR_TYPES.includes(sponsor.type as SponsorType)
        ? (sponsor.type as SponsorType)
        : tiersEnabled
          ? 'STANDARD'
          : null;
    reset({
      name: sponsor.name,
      type,
      websiteUrl: sponsor.websiteUrl ?? undefined,
      isActive: sponsor.isActive,
    });
    setFormOpen(true);
  };

  const clearLogoSelection = () => {
    if (logoFile && logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(editing?.logoUrl ?? null);
    setLogoError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onSubmit = handleSubmit((data) => {
    const payload: CreateSponsorInput = {
      ...data,
      type: tiersEnabled ? (data.type ?? 'STANDARD') : null,
    };
    saveMutation.mutate(payload);
  });

  const byType = useMemo(() => {
    if (!tiersEnabled) {
      return [['ALL', sponsors] as const];
    }
    const map = new Map<string, CompetitionSponsor[]>();
    for (const s of sponsors) {
      const key = s.type || 'UNTITLED';
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [sponsors, tiersEnabled]);

  const labelPreset =
    PARTNER_LABEL_OPTIONS.includes(partnersLabel as (typeof PARTNER_LABEL_OPTIONS)[number])
      ? partnersLabel
      : 'custom';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{partnersLabel}</h1>
          <p className="text-muted-foreground">
            Manage competition {partnersLabel.toLowerCase()} (name
            {tiersEnabled ? ', type' : ''}, logo). Active entries appear on the venue display.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add {singular.toLowerCase()}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display terminology</CardTitle>
          <CardDescription>
            Government or association events often use &quot;Supporters&quot; without sponsor tiers.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Label</Label>
            <Select
              value={labelPreset}
              onValueChange={(v) => {
                if (v === 'custom') return;
                partnersSettingsMutation.mutate({
                  partnersLabel: v,
                  partnerTiersEnabled: tiersEnabled,
                });
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARTNER_LABEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              className="rounded"
              checked={tiersEnabled}
              onChange={(e) => {
                partnersSettingsMutation.mutate({
                  partnersLabel,
                  partnerTiersEnabled: e.target.checked,
                });
              }}
            />
            Use sponsor tiers (Title, Gold, Silver…)
          </label>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Loading {partnersLabel.toLowerCase()}…</p>
      ) : sponsors.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Handshake className="h-5 w-5" />
              No {partnersLabel.toLowerCase()} yet
            </CardTitle>
            <CardDescription>
              Add {singular.toLowerCase()} partners
              {tiersEnabled ? ' with optional tiers' : ''}.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
          {byType.map(([type, items]) => (
            <div key={type} className="space-y-3">
              {tiersEnabled && (
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {type === 'UNTITLED'
                    ? 'No type'
                    : (TYPE_LABELS[type as SponsorType] ?? type)}
                </h2>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((sponsor) => (
                  <Card key={sponsor.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base">{sponsor.name}</CardTitle>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {tiersEnabled && sponsor.type && (
                              <Badge variant="secondary">
                                {TYPE_LABELS[sponsor.type as SponsorType] ?? sponsor.type}
                              </Badge>
                            )}
                            {!sponsor.isActive && <Badge variant="outline">Inactive</Badge>}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(sponsor)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`Delete ${sponsor.name}?`)) {
                                deleteMutation.mutate(sponsor.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex h-24 items-center justify-center rounded-md border bg-muted/40">
                        {sponsor.logoUrl ? (
                          <img
                            src={sponsor.logoUrl}
                            alt={sponsor.name}
                            className="max-h-20 max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground">No logo</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditing(null);
            resetLogoState();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${singular.toLowerCase()}` : `Add ${singular.toLowerCase()}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sponsor-name">Name</Label>
              <Input id="sponsor-name" {...register('name')} placeholder={`${singular} name`} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            {tiersEnabled && (
              <div className="space-y-2">
                <Label>Type (optional)</Label>
                <Select
                  value={selectedType ?? 'STANDARD'}
                  onValueChange={(v) => setValue('type', v as SponsorType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPONSOR_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="sponsor-website">Website (optional)</Label>
              <Input
                id="sponsor-website"
                {...register('websiteUrl')}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Logo (optional)</Label>
              <p className="text-xs text-muted-foreground">
                PNG, JPEG, WebP, or SVG · max 5 MB · applied when you save
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt=""
                    className="h-16 w-16 rounded-md border bg-muted/40 object-contain p-1"
                  />
                ) : (
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                    <ImagePlus className="h-5 w-5" />
                  </span>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setLogoError(null);
                    if (logoFile && logoPreview?.startsWith('blob:')) {
                      URL.revokeObjectURL(logoPreview);
                    }
                    if (!file) {
                      setLogoFile(null);
                      setLogoPreview(editing?.logoUrl ?? null);
                      return;
                    }
                    if (file.size > LOGO_MAX_BYTES) {
                      setLogoError('Logo is too large. Maximum size is 5 MB.');
                      e.target.value = '';
                      return;
                    }
                    setLogoFile(file);
                    setLogoPreview(URL.createObjectURL(file));
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  {logoPreview ? 'Change logo' : 'Add logo'}
                </Button>
                {logoFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={clearLogoSelection}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Clear new selection
                  </Button>
                )}
              </div>
              {(logoError || saveMutation.isError) && (
                <p className="text-sm text-destructive">
                  {logoError ??
                    (saveMutation.error instanceof Error
                      ? saveMutation.error.message
                      : 'Failed to save')}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormOpen(false);
                  setEditing(null);
                  resetLogoState();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : editing ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
