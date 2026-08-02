import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hasPermission, type Organization } from '@npha/shared';
import { ArchiveRestore, Building2, Search } from 'lucide-react';
import {
  Badge,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@npha/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

/**
 * Super-admin list of archived organizations with restore (unarchive).
 */
export function ArchivedOrganizationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const canManage = !!user && hasPermission(user.role, 'platform:organizations');

  const queryKey = useMemo(
    () => ['organizations', 'archived', { search, page, pageSize }] as const,
    [search, page],
  );

  const { data: organizations, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      api.get<Organization[]>('/organizations', {
        status: 'ARCHIVED',
        search: search || undefined,
        page,
        pageSize,
      }),
    enabled: canManage,
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch<Organization>(`/organizations/${id}/status`, { status: 'ACTIVE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Access Restricted</h2>
        <p className="text-muted-foreground">Only Super Admins can manage archived organizations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Archived Organizations</h1>
          <p className="text-muted-foreground">
            Restore archived tenants to ACTIVE. Only Super Admins can access this list.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/organizations">Back to Organizations</Link>
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search archived organizations…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          aria-label="Search archived organizations"
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : organizations?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No archived organizations
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
                    <Badge variant="outline">{org.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={unarchiveMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Unarchive “${org.name}”? It will be restored to ACTIVE.`,
                          )
                        ) {
                          unarchiveMutation.mutate(org.id);
                        }
                      }}
                    >
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                      Unarchive
                    </Button>
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
    </div>
  );
}
