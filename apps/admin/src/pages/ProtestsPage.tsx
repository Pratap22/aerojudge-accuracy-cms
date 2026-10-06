import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompetitionProtest, Permission } from '@aero-judge/shared';
import { ExternalLink, Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@aero-judge/ui';
import { api, apiRequest, ApiError } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';
import { useAnyPermission } from '../hooks/usePermission';

const FORM_MAX_BYTES = 10 * 1024 * 1024;
const FORM_ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp';
const WRITE_PERMISSIONS: Permission[] = ['competition:update', 'score:approve_chief'];

interface PilotOption {
  id: string;
  pilotNumber: number;
  firstName: string;
  lastName: string;
}

function pilotLabel(pilot: PilotOption): string {
  return `${String(pilot.pilotNumber).padStart(3, '0')} · ${pilot.firstName} ${pilot.lastName}`.trim();
}

async function uploadProtestForm(competitionId: string, protestId: string, file: File) {
  const formData = new FormData();
  formData.append('form', file);
  return apiRequest<CompetitionProtest>(
    `/competitions/${competitionId}/protests/${protestId}/form`,
    { method: 'POST', formData },
  );
}

export function ProtestsPage() {
  const competitionId = useCompetitionId();
  const queryClient = useQueryClient();
  const canWrite = useAnyPermission(WRITE_PERMISSIONS);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CompetitionProtest | null>(null);
  const [pilotNumber, setPilotNumber] = useState('');
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: protests = [], isLoading } = useQuery({
    queryKey: ['protests', competitionId],
    queryFn: () => api.get<CompetitionProtest[]>(`/competitions/${competitionId}/protests`),
    enabled: !!competitionId,
  });

  const { data: pilots = [] } = useQuery({
    queryKey: ['pilots', competitionId, 'protest-picker'],
    queryFn: () =>
      api.get<PilotOption[]>(`/competitions/${competitionId}/pilots`, { pageSize: 200 }),
    enabled: !!competitionId && formOpen,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['protests', competitionId] });
    queryClient.invalidateQueries({ queryKey: ['statistics', competitionId] });
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setPilotNumber('');
    setReason('');
    setOutcome('');
    setFormFile(null);
    setFormError(null);
  };

  const openCreate = () => {
    setEditing(null);
    setPilotNumber('');
    setReason('');
    setOutcome('');
    setFormFile(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (protest: CompetitionProtest) => {
    setEditing(protest);
    setPilotNumber(String(protest.pilotNumber));
    setReason(protest.reason);
    setOutcome(protest.outcome);
    setFormFile(null);
    setFormError(null);
    setFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!competitionId) throw new Error('Competition is required');
      const number = Number(pilotNumber);
      if (!Number.isInteger(number) || number < 0) {
        throw new Error('Choose the pilot number');
      }
      if (!reason.trim()) throw new Error('Say why the protest was made');
      if (!outcome.trim()) throw new Error('Record the outcome');
      if (!editing && !formFile) throw new Error('Upload the signed protest form');
      if (formFile) {
        if (formFile.size > FORM_MAX_BYTES) {
          throw new Error('Signed form is too large. Maximum size is 10 MB.');
        }
        const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
        if (formFile.type && !allowed.includes(formFile.type)) {
          throw new Error('Signed form must be a PDF, PNG, JPEG, or WebP file');
        }
      }

      const body = { pilotNumber: number, reason: reason.trim(), outcome: outcome.trim() };
      if (editing) {
        let protest = await api.patch<CompetitionProtest>(
          `/competitions/${competitionId}/protests/${editing.id}`,
          body,
        );
        if (formFile) {
          protest = await uploadProtestForm(competitionId, protest.id, formFile);
        }
        return protest;
      }

      const created = await api.post<CompetitionProtest>(
        `/competitions/${competitionId}/protests`,
        body,
      );
      try {
        return await uploadProtestForm(competitionId, created.id, formFile!);
      } catch (error) {
        await api.delete(`/competitions/${competitionId}/protests/${created.id}`).catch(() => undefined);
        throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Could not save protest');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/competitions/${competitionId}/protests/${id}`),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight">Protests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log each completed protest: who filed it, why, the outcome, and the signed form.
            These entries are included in competition statistics.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Log protest
          </Button>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Pilot</TableHead>
              <TableHead>Why</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Form</TableHead>
              {canWrite && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={canWrite ? 6 : 5} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : protests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canWrite ? 6 : 5} className="text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Scale className="h-4 w-4" />
                    No protests logged yet.
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              protests.map((protest) => (
                <TableRow key={protest.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(protest.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {String(protest.pilotNumber).padStart(3, '0')}
                    </div>
                    <div className="text-xs text-muted-foreground">{protest.pilotName}</div>
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-pre-wrap text-sm">{protest.reason}</TableCell>
                  <TableCell className="max-w-xs whitespace-pre-wrap text-sm">{protest.outcome}</TableCell>
                  <TableCell>
                    {protest.formUrl ? (
                      <a
                        href={protest.formUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {protest.formFileName || 'Signed form'}
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(protest)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            const ok = window.confirm(
                              `Remove the protest from pilot ${String(protest.pilotNumber).padStart(3, '0')}?`,
                            );
                            if (ok) deleteMutation.mutate(protest.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={(open) => (open ? setFormOpen(true) : closeForm())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit protest' : 'Log protest'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="protest-pilot">Pilot number</Label>
              <select
                id="protest-pilot"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={pilotNumber}
                onChange={(event) => setPilotNumber(event.target.value)}
                required
              >
                <option value="">Select pilot number</option>
                {[...pilots]
                  .sort((a, b) => a.pilotNumber - b.pilotNumber)
                  .map((pilot) => (
                    <option key={pilot.id} value={String(pilot.pilotNumber)}>
                      {pilotLabel(pilot)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="protest-reason">Why they protested</Label>
              <Textarea
                id="protest-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="What the pilot is protesting"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="protest-outcome">Outcome</Label>
              <Textarea
                id="protest-outcome"
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Upheld, dismissed, score changed…"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="protest-form">Signed protest form</Label>
              <input
                id="protest-form"
                type="file"
                accept={FORM_ACCEPT}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
                onChange={(event) => setFormFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                PDF, PNG, JPEG, or WebP · max 10 MB
                {editing?.formFileName ? ` · current file: ${editing.formFileName}` : ''}
              </p>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>
              Cancel
            </Button>
            <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Save protest' : 'Log protest'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
