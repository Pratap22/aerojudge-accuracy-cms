import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Search } from 'lucide-react';
import {
  Badge,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@npha/ui';
import { api, ApiError } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';

interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string | null;
  userName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string;
  ipAddress?: string | null;
}

function entityIdLabel(entityId: string | null): string {
  if (!entityId) return '—';
  return entityId.length > 10 ? `${entityId.slice(0, 8)}…` : entityId;
}

export function AuditPage() {
  const activeCompetitionId = useCompetitionId();
  const [search, setSearch] = useState('');

  const {
    data: entries,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['audit', activeCompetitionId, search],
    queryFn: () =>
      api.get<AuditEntry[]>(`/competitions/${activeCompetitionId}/audit`, {
        search: search || undefined,
        pageSize: 100,
        sortOrder: 'desc',
      }),
    enabled: !!activeCompetitionId,
  });

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

  const errorMessage =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Failed to load audit log';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">Immutable record of competition actions</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search actions, users, entities…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-destructive">
                  {errorMessage}
                </TableCell>
              </TableRow>
            ) : entries?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  No audit entries found for this competition.
                </TableCell>
              </TableRow>
            ) : (
              entries?.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(entry.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>{entry.userName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{entry.action}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {entry.entityType}
                    <span className="block text-muted-foreground">
                      {entityIdLabel(entry.entityId)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm" title={entry.details}>
                    {entry.details}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
