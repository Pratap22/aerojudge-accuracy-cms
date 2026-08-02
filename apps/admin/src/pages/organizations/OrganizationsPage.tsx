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
import { Building2, Plus, Search } from 'lucide-react';
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
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const pageSize = 20;

  const canRead = user && (user.organizations?.length || hasPermission(user.role, 'organization:read') || hasPermission(user.role, 'platform:organizations'));
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
      // Archived orgs have a dedicated Super Admin screen
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

  const createMutation = useMutation({
    mutationFn: (data: CreateOrganizationInput) => api.post<Organization>('/organizations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setFormOpen(false);
      reset();
    },
  });

  if (!canRead) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Access Restricted</h2>
        <p className="text-muted-foreground">You do not have permission to view organizations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-muted-foreground">
            Manage federations, clubs, and commercial tenants that own competitions
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button variant="outline" asChild>
              <Link to="/organizations/archived">Archived</Link>
            </Button>
          )}
          {canManage && (
            <Button
              onClick={() => {
                reset();
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Organization
            </Button>
          )}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, slug, or country…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          aria-label="Search organizations"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Competitions</TableHead>
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
                  <TableCell className="font-mono text-sm">{org.slug}</TableCell>
                  <TableCell>{org.country ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{org.plan}</Badge>
                  </TableCell>
                  <TableCell>{org._count?.competitions ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[org.status]}>{org.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!organizations || organizations.length < pageSize}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
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
              <Input id="country" {...register('country')} />
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
