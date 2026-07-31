import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  hasEffectivePermission,
  updateOrganizationSchema,
  type Organization,
  type OrganizationSettingsInput,
  type UpdateOrganizationInput,
} from '@npha/shared';
import { ArrowLeft, Building2, Upload } from 'lucide-react';
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
} from '@npha/ui';
import { api, getAccessToken } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { competitionPath } from '../../hooks/useCompetitionId';
import { OrganizationMembersPage } from './OrganizationMembersPage';
import { OrganizationRolesPage } from './OrganizationRolesPage';

type Tab = 'details' | 'branding' | 'settings' | 'competitions' | 'members' | 'roles';

interface OrgCompetition {
  id: string;
  name: string;
  code: string;
  status: string;
  venue: string;
  country: string;
  startDate: string;
  isPublished: boolean;
}

/** Members UI embedded in org detail (reads organizationId from route params). */
function OrganizationMembersEmbedded(_props: { organizationId: string }) {
  return <OrganizationMembersPage />;
}

function OrganizationRolesEmbedded(_props: { organizationId: string }) {
  return <OrganizationRolesPage />;
}

/**
 * Organization detail: profile, branding, settings, competitions, status actions.
 */
export function OrganizationDetailPage() {
  const { organizationId = '' } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('details');
  const fileRef = useRef<HTMLInputElement>(null);

  const canRead =
    !!user &&
    (hasEffectivePermission({
      platformRole: user.role,
      orgRole: user.orgRole,
      permissions: user.permissions,
      permission: 'organization:read',
    }) ||
      !!user.organizations?.length);
  const canManage =
    !!user &&
    hasEffectivePermission({
      platformRole: user.role,
      orgRole: user.orgRole,
      permissions: user.permissions,
      permission: 'organization:manage',
    });

  const { data: org, isLoading } = useQuery({
    queryKey: ['organizations', organizationId],
    queryFn: () => api.get<Organization>(`/organizations/${organizationId}`),
    enabled: !!canRead && !!organizationId,
  });

  const { data: competitions } = useQuery({
    queryKey: ['organizations', organizationId, 'competitions'],
    queryFn: () =>
      api.get<OrgCompetition[]>(`/organizations/${organizationId}/competitions`, {
        page: 1,
        pageSize: 50,
      }),
    enabled: !!canRead && !!organizationId && tab === 'competitions',
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UpdateOrganizationInput>({
    resolver: zodResolver(updateOrganizationSchema),
  });

  useEffect(() => {
    if (!org) return;
    reset({
      name: org.name,
      shortName: org.shortName,
      slug: org.slug,
      description: org.description ?? undefined,
      website: org.website ?? undefined,
      email: org.email ?? undefined,
      phone: org.phone ?? undefined,
      address: org.address ?? undefined,
      city: org.city ?? undefined,
      state: org.state ?? undefined,
      country: org.country ?? undefined,
      timezone: org.timezone,
      currency: org.currency,
      primaryColor: org.primaryColor ?? undefined,
      secondaryColor: org.secondaryColor ?? undefined,
      accentColor: org.accentColor ?? undefined,
      defaultRuleProfile: org.defaultRuleProfile,
      plan: org.plan,
      maxCompetitions: org.maxCompetitions,
      maxUsers: org.maxUsers,
    });
  }, [org, reset]);

  const primaryColor = watch('primaryColor');
  const secondaryColor = watch('secondaryColor');
  const accentColor = watch('accentColor');
  const plan = watch('plan');
  const ruleProfile = watch('defaultRuleProfile');

  const saveMutation = useMutation({
    mutationFn: (data: UpdateOrganizationInput) =>
      api.put<Organization>(`/organizations/${organizationId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED') =>
      api.patch<Organization>(`/organizations/${organizationId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  const settingsMutation = useMutation({
    mutationFn: (data: OrganizationSettingsInput) =>
      api.put<Organization>(`/organizations/${organizationId}/settings`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId] });
    },
  });

  const logoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      const token = getAccessToken();
      const res = await fetch(`/api/v1/organizations/${organizationId}/logo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Upload failed');
      }
      return json.data as Organization;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId] });
    },
  });

  if (!canRead) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Access Restricted</h2>
      </div>
    );
  }

  if (isLoading || !org) {
    return <p className="text-muted-foreground">Loading organization…</p>;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'details', label: 'Details' },
    { id: 'branding', label: 'Branding' },
    { id: 'settings', label: 'Settings' },
    { id: 'members', label: 'Users' },
    { id: 'roles', label: 'Roles' },
    { id: 'competitions', label: 'Competitions' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Link
            to="/organizations"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Organizations
          </Link>
          <div className="flex items-center gap-3">
            {org.logoUrl ? (
              <img
                src={org.logoUrl}
                alt=""
                className="h-12 w-12 rounded-md object-contain bg-muted"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{org.name}</h1>
              <p className="text-sm text-muted-foreground">
                {org.shortName} · {org.slug}
              </p>
            </div>
            <Badge variant="secondary">{org.status}</Badge>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            {org.status !== 'ACTIVE' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => statusMutation.mutate('ACTIVE')}
                disabled={statusMutation.isPending}
              >
                Activate
              </Button>
            )}
            {org.status === 'ACTIVE' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => statusMutation.mutate('INACTIVE')}
                disabled={statusMutation.isPending}
              >
                Deactivate
              </Button>
            )}
            {org.status !== 'ARCHIVED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (
                    window.confirm(
                      'Archive this organization? Competitions remain but the org will be inactive.',
                    )
                  ) {
                    statusMutation.mutate('ARCHIVED');
                  }
                }}
                disabled={statusMutation.isPending}
              >
                Archive
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b" role="tablist" aria-label="Organization sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <form
          className="grid max-w-3xl gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((data) => saveMutation.mutate(data))}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} disabled={!canManage} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="shortName">Short name</Label>
            <Input id="shortName" {...register('shortName')} disabled={!canManage} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" {...register('slug')} disabled={!canManage} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...register('description')} disabled={!canManage} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input id="website" {...register('website')} disabled={!canManage} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} disabled={!canManage} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register('phone')} disabled={!canManage} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" {...register('country')} disabled={!canManage} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...register('address')} disabled={!canManage} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" {...register('city')} disabled={!canManage} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State / Region</Label>
            <Input id="state" {...register('state')} disabled={!canManage} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" {...register('timezone')} disabled={!canManage} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" {...register('currency')} disabled={!canManage} />
          </div>
          {canManage && (
            <div className="sm:col-span-2">
              <Button type="submit" disabled={isSubmitting || saveMutation.isPending}>
                Save details
              </Button>
            </div>
          )}
        </form>
      )}

      {tab === 'branding' && (
        <div className="grid max-w-3xl gap-6">
          <div className="space-y-3">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              {org.logoUrl ? (
                <img
                  src={org.logoUrl}
                  alt={`${org.name} logo`}
                  className="h-20 w-20 rounded-md object-contain bg-muted"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                  No logo
                </div>
              )}
              {canManage && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) logoMutation.mutate(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    disabled={logoMutation.isPending}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload logo
                  </Button>
                </>
              )}
            </div>
          </div>

          <form
            className="grid gap-4 sm:grid-cols-3"
            onSubmit={handleSubmit((data) =>
              saveMutation.mutate({
                primaryColor: data.primaryColor,
                secondaryColor: data.secondaryColor,
                accentColor: data.accentColor,
              }),
            )}
          >
            {(
              [
                ['primaryColor', 'Primary', primaryColor],
                ['secondaryColor', 'Secondary', secondaryColor],
                ['accentColor', 'Accent', accentColor],
              ] as const
            ).map(([field, label, value]) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={field}>{label}</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    aria-label={`${label} color picker`}
                    className="h-10 w-12 cursor-pointer rounded border bg-transparent"
                    value={value && /^#/.test(value) ? value : '#0b1f33'}
                    disabled={!canManage}
                    onChange={(e) => setValue(field, e.target.value)}
                  />
                  <Input id={field} {...register(field)} disabled={!canManage} placeholder="#0b1f33" />
                </div>
              </div>
            ))}
            {canManage && (
              <div className="sm:col-span-3">
                <Button type="submit" disabled={saveMutation.isPending}>
                  Save branding
                </Button>
              </div>
            )}
          </form>
        </div>
      )}

      {tab === 'settings' && (
        <form
          className="grid max-w-3xl gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((data) => {
            saveMutation.mutate({
              plan: data.plan,
              defaultRuleProfile: data.defaultRuleProfile,
              maxCompetitions: data.maxCompetitions,
              maxUsers: data.maxUsers,
            });
            settingsMutation.mutate({
              competitionDefaultsJson: {
                defaultRuleProfile: data.defaultRuleProfile,
                maxCompetitions: data.maxCompetitions,
              },
              printingDefaultsJson: org.settings?.printingDefaultsJson ?? { format: 'A4_PORTRAIT' },
              displayDefaultsJson: org.settings?.displayDefaultsJson ?? {},
              certificatesJson: org.settings?.certificatesJson ?? {},
              reportsJson: org.settings?.reportsJson ?? {},
              notificationDefaultsJson: org.settings?.notificationDefaultsJson ?? {},
              ruleProfileJson: { version: data.defaultRuleProfile },
            });
          })}
        >
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select
              value={plan}
              disabled={!canManage}
              onValueChange={(v) => setValue('plan', v as UpdateOrganizationInput['plan'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'].map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Default rule profile</Label>
            <Select
              value={ruleProfile}
              disabled={!canManage}
              onValueChange={(v) =>
                setValue(
                  'defaultRuleProfile',
                  v as UpdateOrganizationInput['defaultRuleProfile'],
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FAI_2022">FAI 2022</SelectItem>
                <SelectItem value="FAI_FUTURE">FAI Future</SelectItem>
                <SelectItem value="NPHA_LOCAL">National / Local</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxCompetitions">Max competitions</Label>
            <Input
              id="maxCompetitions"
              type="number"
              {...register('maxCompetitions', { valueAsNumber: true })}
              disabled={!canManage}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxUsers">Max users</Label>
            <Input
              id="maxUsers"
              type="number"
              {...register('maxUsers', { valueAsNumber: true })}
              disabled={!canManage}
            />
          </div>
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Competition, printing, display, certificate, report, and notification defaults are
            stored on the organization and applied when creating new competitions.
          </p>
          {canManage && (
            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={saveMutation.isPending || settingsMutation.isPending}
              >
                Save settings
              </Button>
            </div>
          )}
        </form>
      )}

      {tab === 'members' && <OrganizationMembersEmbedded organizationId={organizationId} />}

      {tab === 'roles' && <OrganizationRolesEmbedded organizationId={organizationId} />}

      {tab === 'competitions' && (
        <div className="space-y-3">
          {competitions?.length === 0 && (
            <p className="text-muted-foreground">No competitions for this organization yet.</p>
          )}
          <ul className="divide-y rounded-lg border">
            {competitions?.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <Link
                    to={competitionPath(c.id)}
                    className="font-medium text-primary hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {c.code} · {c.venue}, {c.country}
                  </p>
                </div>
                <Badge variant="secondary">{c.status}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
