import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCompetitionContactSchema,
  createCompetitionLinkSchema,
  isEmptyHtml,
  type CompetitionContact,
  type CompetitionEventInfo,
  type CompetitionGalleryImage,
  type CompetitionLink,
  type CreateCompetitionContactInput,
  type CreateCompetitionLinkInput,
  type UpdateCompetitionInfoInput,
} from '@npha/shared';
import {
  Eye,
  EyeOff,
  ImagePlus,
  Link2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import {
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@npha/ui';
import { api, apiRequest } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';
import { PageHeader } from '../components/PageHeader';
import { RichTextEditor } from '../components/RichTextEditor';

const GALLERY_MAX_BYTES = 8 * 1024 * 1024;

type HtmlFieldKey =
  | 'aboutHtml'
  | 'dailyScheduleHtml'
  | 'selectionRulesHtml'
  | 'entryFeePaymentHtml'
  | 'flyingSiteHtml'
  | 'travelInfoHtml';

const RICH_SECTIONS: Array<{ key: HtmlFieldKey; label: string; hint: string }> = [
  {
    key: 'aboutHtml',
    label: 'About',
    hint: 'Purpose, local rules overview, prizes, what the entry fee includes.',
  },
  {
    key: 'dailyScheduleHtml',
    label: 'Daily schedule',
    hint: 'Competition days and typical daily timetable.',
  },
  {
    key: 'selectionRulesHtml',
    label: 'Selection rules',
    hint: 'Required documentation, eligibility, team criteria.',
  },
  {
    key: 'entryFeePaymentHtml',
    label: 'Entry fee payment',
    hint: 'Fees, payment methods, and what is included.',
  },
  {
    key: 'flyingSiteHtml',
    label: 'Flying site',
    hint: 'Take-off, landing, altitudes, and site notes.',
  },
  {
    key: 'travelInfoHtml',
    label: 'Travel info',
    hint: 'How to reach the venue, transfers, arrival tips.',
  },
];

export function EventInfoPage() {
  const competitionId = useCompetitionId();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: info, isLoading } = useQuery({
    queryKey: ['competition-info', competitionId],
    queryFn: () => api.get<CompetitionEventInfo>(`/competitions/${competitionId}/info`),
    enabled: !!competitionId,
  });

  const [draft, setDraft] = useState<UpdateCompetitionInfoInput>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!info) return;
    setDraft({
      aboutHtml: info.aboutHtml,
      dailyScheduleHtml: info.dailyScheduleHtml,
      selectionRulesHtml: info.selectionRulesHtml,
      entryFeePaymentHtml: info.entryFeePaymentHtml,
      flyingSiteHtml: info.flyingSiteHtml,
      travelInfoHtml: info.travelInfoHtml,
      mapLabel: info.mapLabel ?? undefined,
      mapZoom: info.mapZoom,
      latitude: info.latitude,
      longitude: info.longitude,
      location: info.location ?? undefined,
    });
    setDirty(false);
  }, [info]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['competition-info', competitionId] });
  };

  const saveMutation = useMutation({
    mutationFn: (body: UpdateCompetitionInfoInput) =>
      api.put<CompetitionEventInfo>(`/competitions/${competitionId}/info`, body),
    onSuccess: () => {
      invalidate();
      setDirty(false);
      toast({ title: 'Event info saved' });
    },
    onError: (err: Error) => toast({ title: 'Save failed', description: err.message, variant: 'destructive' }),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > GALLERY_MAX_BYTES) {
        throw new Error('Image is too large. Maximum size is 8 MB.');
      }
      const formData = new FormData();
      formData.append('image', file);
      return apiRequest<CompetitionGalleryImage>(
        `/competitions/${competitionId}/info/gallery`,
        { method: 'POST', formData },
      );
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Image uploaded' });
    },
    onError: (err: Error) =>
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' }),
  });

  const deleteImageMutation = useMutation({
    mutationFn: (imageId: string) =>
      api.delete(`/competitions/${competitionId}/info/gallery/${imageId}`),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Image removed' });
    },
  });

  const updateImageMutation = useMutation({
    mutationFn: ({ imageId, caption }: { imageId: string; caption: string }) =>
      api.patch(`/competitions/${competitionId}/info/gallery/${imageId}`, {
        caption: caption || null,
      }),
    onSuccess: () => invalidate(),
  });

  const setHtml = (key: HtmlFieldKey, html: string) => {
    setDraft((prev) => ({ ...prev, [key]: isEmptyHtml(html) ? null : html }));
    setDirty(true);
  };

  const setMapField = <K extends keyof UpdateCompetitionInfoInput>(
    key: K,
    value: UpdateCompetitionInfoInput[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  if (!competitionId) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event info"
        description="Public brochure content shown on the competition info page. Empty sections are hidden."
        actions={
          <Button
            onClick={() => saveMutation.mutate(draft)}
            disabled={!dirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        }
      />

      {isLoading || !info ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Tabs defaultValue="about">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            {RICH_SECTIONS.map((s) => (
              <TabsTrigger key={s.key} value={s.key.replace('Html', '')}>
                {s.label}
              </TabsTrigger>
            ))}
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
            <TabsTrigger value="map">Event map</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
          </TabsList>

          {RICH_SECTIONS.map((section) => (
            <TabsContent key={section.key} value={section.key.replace('Html', '')} className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>{section.label}</CardTitle>
                  <CardDescription>{section.hint}</CardDescription>
                </CardHeader>
                <CardContent>
                  <RichTextEditor
                    value={(draft[section.key] as string | null | undefined) ?? ''}
                    onChange={(html) => setHtml(section.key, html)}
                    placeholder={`Write ${section.label.toLowerCase()}…`}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          ))}

          <TabsContent value="gallery" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Gallery</CardTitle>
                  <CardDescription>
                    Take-off, landing, and competition photos. Shown only when images exist.
                  </CardDescription>
                </div>
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadMutation.mutate(file);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadMutation.isPending}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadMutation.isPending ? 'Uploading…' : 'Upload image'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {info.gallery.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center text-muted-foreground">
                    <ImagePlus className="mb-2 h-8 w-8 opacity-40" />
                    <p className="text-sm">No gallery images yet.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {info.gallery.map((image) => (
                      <GalleryCard
                        key={image.id}
                        image={image}
                        onSaveCaption={(caption) =>
                          updateImageMutation.mutate({ imageId: image.id, caption })
                        }
                        onDelete={() => deleteImageMutation.mutate(image.id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="map" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Event map</CardTitle>
                <CardDescription>
                  Coordinates power the OpenStreetMap embed on the public info page.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={draft.latitude ?? ''}
                    onChange={(e) =>
                      setMapField(
                        'latitude',
                        e.target.value === '' ? null : Number(e.target.value),
                      )
                    }
                    placeholder="e.g. 27.175"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={draft.longitude ?? ''}
                    onChange={(e) =>
                      setMapField(
                        'longitude',
                        e.target.value === '' ? null : Number(e.target.value),
                      )
                    }
                    placeholder="e.g. 88.606"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mapZoom">Zoom (1–19)</Label>
                  <Input
                    id="mapZoom"
                    type="number"
                    min={1}
                    max={19}
                    value={draft.mapZoom ?? 13}
                    onChange={(e) => setMapField('mapZoom', Number(e.target.value) || 13)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mapLabel">Map label</Label>
                  <Input
                    id="mapLabel"
                    value={draft.mapLabel ?? ''}
                    onChange={(e) => setMapField('mapLabel', e.target.value || undefined)}
                    placeholder={info.venue}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="location">Location detail</Label>
                  <Input
                    id="location"
                    value={draft.location ?? ''}
                    onChange={(e) => setMapField('location', e.target.value || undefined)}
                    placeholder="Optional address or area description"
                  />
                </div>
                {draft.latitude != null && draft.longitude != null ? (
                  <div className="sm:col-span-2 overflow-hidden rounded-lg border">
                    <iframe
                      title="Event map preview"
                      className="h-64 w-full border-0"
                      src={osmEmbedUrl(draft.latitude, draft.longitude, draft.mapZoom ?? 13)}
                      loading="lazy"
                    />
                    <p className="flex items-center gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {draft.mapLabel || info.venue}
                    </p>
                  </div>
                ) : (
                  <p className="sm:col-span-2 text-sm text-muted-foreground">
                    Set latitude and longitude to preview the map. The section stays hidden on the
                    public page until both are set.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="links" className="mt-4">
            <LinksPanel
              competitionId={competitionId}
              links={info.links}
              onChange={invalidate}
            />
          </TabsContent>

          <TabsContent value="contacts" className="mt-4">
            <ContactsPanel
              competitionId={competitionId}
              contacts={info.contacts}
              onChange={invalidate}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function osmEmbedUrl(lat: number, lng: number, zoom: number): string {
  const delta = 0.02 * Math.pow(2, 13 - zoom);
  const minLon = lng - delta;
  const minLat = lat - delta;
  const maxLon = lng + delta;
  const maxLat = lat + delta;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function GalleryCard({
  image,
  onSaveCaption,
  onDelete,
}: {
  image: CompetitionGalleryImage;
  onSaveCaption: (caption: string) => void;
  onDelete: () => void;
}) {
  const [caption, setCaption] = useState(image.caption ?? '');
  useEffect(() => setCaption(image.caption ?? ''), [image.caption]);

  return (
    <div className="overflow-hidden rounded-lg border">
      <img src={image.url} alt={image.caption ?? ''} className="aspect-video w-full object-cover" />
      <div className="space-y-2 p-3">
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => {
            if ((image.caption ?? '') !== caption) onSaveCaption(caption);
          }}
          placeholder="Caption (optional)"
        />
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={onDelete}>
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Remove
        </Button>
      </div>
    </div>
  );
}

function LinksPanel({
  competitionId,
  links,
  onChange,
}: {
  competitionId: string;
  links: CompetitionLink[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CompetitionLink | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCompetitionLinkInput>({
    resolver: zodResolver(createCompetitionLinkSchema),
    defaultValues: { label: '', url: '' },
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateCompetitionLinkInput) =>
      api.post(`/competitions/${competitionId}/info/links`, body),
    onSuccess: () => {
      onChange();
      setOpen(false);
      reset({ label: '', url: '' });
      toast({ title: 'Link added' });
    },
    onError: (err: Error) =>
      toast({ title: 'Failed', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: (body: CreateCompetitionLinkInput) =>
      api.patch(`/competitions/${competitionId}/info/links/${editing!.id}`, body),
    onSuccess: () => {
      onChange();
      setOpen(false);
      setEditing(null);
      toast({ title: 'Link updated' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (linkId: string) =>
      api.delete(`/competitions/${competitionId}/info/links/${linkId}`),
    onSuccess: () => {
      onChange();
      toast({ title: 'Link removed' });
    },
  });

  const openCreate = () => {
    setEditing(null);
    reset({ label: '', url: '' });
    setOpen(true);
  };

  const openEdit = (link: CompetitionLink) => {
    setEditing(link);
    reset({ label: link.label, url: link.url });
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Links</CardTitle>
          <CardDescription>WhatsApp groups, local rules PDFs, external event pages.</CardDescription>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add link
        </Button>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">No links yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {links.map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{link.label}</p>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-xs text-primary hover:underline"
                  >
                    {link.url}
                  </a>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(link)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(link.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit link' : 'Add link'}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) =>
              editing ? updateMutation.mutate(values) : createMutation.mutate(values),
            )}
          >
            <div className="space-y-2">
              <Label htmlFor="link-label">Label</Label>
              <Input id="link-label" {...register('label')} />
              {errors.label ? (
                <p className="text-xs text-destructive">{errors.label.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-url">URL</Label>
              <Input id="link-url" type="url" placeholder="https://" {...register('url')} />
              {errors.url ? <p className="text-xs text-destructive">{errors.url.message}</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                <Link2 className="mr-2 h-4 w-4" />
                {editing ? 'Save' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ContactsPanel({
  competitionId,
  contacts,
  onChange,
}: {
  competitionId: string;
  contacts: CompetitionContact[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CompetitionContact | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateCompetitionContactInput>({
    resolver: zodResolver(createCompetitionContactSchema),
    defaultValues: { name: '', role: '', phone: undefined, email: undefined, isPublic: true },
  });
  const isPublic = watch('isPublic') ?? true;

  const createMutation = useMutation({
    mutationFn: (body: CreateCompetitionContactInput) =>
      api.post(`/competitions/${competitionId}/info/contacts`, body),
    onSuccess: () => {
      onChange();
      setOpen(false);
      reset();
      toast({ title: 'Contact added' });
    },
    onError: (err: Error) =>
      toast({ title: 'Failed', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: (body: CreateCompetitionContactInput) =>
      api.patch(`/competitions/${competitionId}/info/contacts/${editing!.id}`, body),
    onSuccess: () => {
      onChange();
      setOpen(false);
      setEditing(null);
      toast({ title: 'Contact updated' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (contactId: string) =>
      api.delete(`/competitions/${competitionId}/info/contacts/${contactId}`),
    onSuccess: () => {
      onChange();
      toast({ title: 'Contact removed' });
    },
  });

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', role: '', phone: undefined, email: undefined, isPublic: true });
    setOpen(true);
  };

  const openEdit = (contact: CompetitionContact) => {
    setEditing(contact);
    reset({
      name: contact.name,
      role: contact.role,
      phone: contact.phone ?? undefined,
      email: contact.email ?? undefined,
      isPublic: contact.isPublic,
    });
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Contacts</CardTitle>
          <CardDescription>
            Event coordinators (accommodation, transport, etc.). Distinct from Officials.
          </CardDescription>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add contact
        </Button>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contacts yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {contacts.map((contact) => (
              <li key={contact.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{contact.name}</p>
                    {contact.isPublic ? (
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{contact.role}</p>
                  <p className="text-xs text-muted-foreground">
                    {[contact.phone, contact.email].filter(Boolean).join(' · ') || 'No phone/email'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(contact)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(contact.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit contact' : 'Add contact'}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) =>
              editing ? updateMutation.mutate(values) : createMutation.mutate(values),
            )}
          >
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name</Label>
              <Input id="contact-name" {...register('name')} />
              {errors.name ? (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-role">Role</Label>
              <Input
                id="contact-role"
                placeholder="e.g. Event Coordinator"
                {...register('role')}
              />
              {errors.role ? (
                <p className="text-xs text-destructive">{errors.role.message}</p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Phone</Label>
                <Input id="contact-phone" {...register('phone')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input id="contact-email" type="email" {...register('email')} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setValue('isPublic', e.target.checked)}
              />
              Show on public info page
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? 'Save' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
