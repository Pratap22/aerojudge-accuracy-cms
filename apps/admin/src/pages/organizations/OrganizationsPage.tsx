import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createOrganizationSchema,
  hasPermission,
  type CreateOrganizationInput,
  type Organization,
  type OrganizationStatus,
} from '@npha/shared';
import { Building2, ChevronRight, Plus, Search } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
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
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { PageHeader } from '../../components/PageHeader';
import { CountrySelect } from '../../components/CountrySelect';

const STATUS_VARIANT: Record<
  OrganizationStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  ARCHIVED: 'outline',
};

/**
 * Global organization list with create dialog, search, and pagination.
 */
export function OrganizationsPage() {
  const { user, refreshMemberships } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const pageSize = 20;

  const canRead =
    user &&
    (user.organizations?.length ||
      hasPermission(user.role, 'organization:read') ||
      hasPermission(user.role, 'platform:organizations'));
  const canManage = user && hasPermission(user.role, 'platform:organizations');

  const queryKey = useMemo(
    () => ['organizations', 'active-list', { search, page, pageSize }] as const,
    [search, page],
  );

  const { data: organizations, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const rows = await api.get<Organization[]>('/organizations', {
        search: search || undefined,
        page,
        pageSize,
      });
      return rows.filter((org) => org.status !== 'ARCHIVED');
    },
    enabled: !!canRead,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrganizationInput>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: '',
      shortName: '',
      slug: '',
      timezone: 'UTC',
      currency: 'USD',
      defaultRuleProfile: 'FAI_2022',
      plan: 'FREE',
      maxCompetitions: 10,
      maxUsers: 25,
    },
  });

  const plan = watch('plan');
  const ruleProfile = watch('defaultRuleProfile');
  const country = watch('country');

  const createMutation = useMutation({
    mutationFn: (data: CreateOrganizationInput) => api.post<Organization>('/organizations', data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      // Sidebar dropdown reads AuthContext memberships, not the orgs list query
      await refreshMemberships();
      setFormOpen(false);
      reset();
    },
  });

  if (!canRead) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Access restricted</h2>
        <p className="text-muted-foreground">You do not have permission to view organizations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Organizations"
        description="Federations, clubs, and commercial tenants that own competitions."
        actions={
          <>
            {canManage && (
              <Button variant="outline" asChild className="w-full sm:w-auto">
                <Link to="/organizations/archived">Archived</Link>
              </Button>
            )}
            {canManage && (
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  reset();
                  setFormOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create organization
              </Button>
            )}
          </>
        }
      />

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 pl-9 sm:h-10"
          placeholder="Search by name, slug, or country…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          aria-label="Search organizations"
        />
      </div>

      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : organizations?.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No organizations found</p>
        ) : (
          organizations?.map((org) => (
            <Link key={org.id} to={`/organizations/${org.id}`} className="block">
              <Card className="transition-colors hover:bg-muted/30">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-primary">{org.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {org.shortName}
                      {org.country ? ` · ${org.country}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {org.plan}
                      </Badge>
                      <Badge variant={STATUS_VARIANT[org.status]} className="text-[10px]">
                        {org.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {org._count?.competitions ?? 0} competitions
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead className="hidden lg:table-cell">Slug</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Competitions</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : organizations?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No organizations found
                </TableCell>
              </TableRow>
            ) : (
              organizations?.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <Link
                      to={`/organizations/${org.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {org.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{org.shortName}</p>
                  </TableCell>
                  <TableCell className="hidden font-mono text-sm lg:table-cell">{org.slug}</TableCell>
                  <TableCell>{org.country ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{org.plan}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{org._count?.competitions ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[org.status]}>{org.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-w-[5.5rem]"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="min-w-[5.5rem]"
            disabled={!organizations || organizations.length < pageSize}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={handleSubmit((data) => createMutation.mutate(data))}
          >
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shortName">Short name</Label>
                <Input id="shortName" {...register('shortName')} />
                {errors.shortName && (
                  <p className="text-sm text-destructive">{errors.shortName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" placeholder="fai" {...register('slug')} />
                {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <CountrySelect
                id="country"
                value={country}
                onChange={(selected) => setValue('country', selected?.name ?? undefined)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select
                  value={plan}
                  onValueChange={(v) => setValue('plan', v as CreateOrganizationInput['plan'])}
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
                  onValueChange={(v) =>
                    setValue(
                      'defaultRuleProfile',
                      v as CreateOrganizationInput['defaultRuleProfile'],
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
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting || createMutation.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
