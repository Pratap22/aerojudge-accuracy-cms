import { Link } from 'react-router-dom';
import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Pause,
  Play,
  Plus,
  Square,
  CheckCircle,
  CheckCircle2,
  Lock,
  RotateCcw,
  Download,
  Loader2,
  Upload,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
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
} from '@npha/ui';
import type { CompetitionStatus, ReportType, RoundStatus, RoundType } from '@npha/shared';
import { api, ApiError, apiFetch, apiRequest } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';
import { usePermission } from '../hooks/usePermission';

interface ScoreImportResult {
  format: 'wide' | 'long';
  roundsDetected: number[];
  roundsCreated: number[];
  scoresUpserted: number;
  rowsProcessed: number;
  skipped: { pilotNumber: number; round?: number; reason: string }[];
  unknownPilots: number[];
}
interface RoundApi {
  id: string;
  number: number;
  name: string | null;
  type: RoundType;
  status: RoundStatus;
  scheduledAt: string | null;
  _count?: { flights: number; scores: number };
  flightsTotal?: number;
  flightsScored?: number;
}

interface CompetitionInfo {
  id: string;
  maxRounds: number;
  practiceRounds: number;
  status: CompetitionStatus;
  isPublished?: boolean;
}

interface TeamListItem {
  id: string;
}

const statusColors: Record<
  RoundStatus,
  'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
> = {
  SCHEDULED: 'outline',
  BRIEFING: 'secondary',
  OPEN: 'secondary',
  ACTIVE: 'success',
  PAUSED: 'warning',
  CLOSED: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  LOCKED: 'default',
  CANCELLED: 'destructive',
};

type RoundAction = 'start' | 'pause' | 'resume' | 'close' | 'reopen' | 'approve' | 'lock';

/** Previous round must reach one of these before Create Round is allowed. */
const COMPLETED_FOR_NEXT: RoundStatus[] = [
  'CLOSED',
  'PENDING_APPROVAL',
  'APPROVED',
  'LOCKED',
  'CANCELLED',
];

function normalizeRound(round: RoundApi) {
  return {
    ...round,
    name: round.name ?? '',
    flightsTotal: round.flightsTotal ?? round._count?.flights ?? 0,
    flightsScored: round.flightsScored ?? round._count?.scores ?? 0,
  };
}

async function downloadReportPdf(
  competitionId: string,
  reportType: ReportType,
  roundId?: string,
): Promise<void> {
  const result = await api.post<{ print: { id: string }; filename: string }>(
    `/competitions/${competitionId}/reports/generate`,
    {
      reportType,
      format: 'A4_PORTRAIT',
      // Round id stamps the PDF with that round’s approver when available.
      ...(roundId ? { roundId } : {}),
    },
  );
  const response = await apiFetch(
    `/competitions/${competitionId}/reports/${result.print.id}/download`,
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? `Download failed (${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename || `${reportType.toLowerCase()}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function RoundsPage() {
  const competitionId = useCompetitionId();
  const queryClient = useQueryClient();
  const canUpdateCompetition = usePermission('competition:update');
  const [createOpen, setCreateOpen] = useState(false);
  const [roundType, setRoundType] = useState<'OFFICIAL' | 'PRACTICE'>('OFFICIAL');
  const [roundName, setRoundName] = useState('');
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<{
    roundId?: string;
    message: string;
  } | null>(null);
  const scoreImportRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<ScoreImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const { data: competition } = useQuery({
    queryKey: ['competition', competitionId],
    queryFn: () => api.get<CompetitionInfo>(`/competitions/${competitionId}`),
    enabled: !!competitionId,
  });

  const { data: roundsRaw, isLoading } = useQuery({
    queryKey: ['rounds', competitionId],
    queryFn: () => api.get<RoundApi[]>(`/competitions/${competitionId}/rounds`),
    enabled: !!competitionId,
  });

  const { data: teams } = useQuery({
    queryKey: ['teams', competitionId],
    queryFn: () =>
      api.get<TeamListItem[]>(`/competitions/${competitionId}/teams`, { pageSize: 200 }),
    enabled: !!competitionId,
  });

  const importScoresMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiRequest<ScoreImportResult>(`/competitions/${competitionId}/rounds/import-scores`, {
        method: 'POST',
        formData,
      });
    },
    onSuccess: (result) => {
      setImportError(null);
      setImportResult(result);
      void queryClient.invalidateQueries({ queryKey: ['rounds', competitionId] });
      void queryClient.invalidateQueries({ queryKey: ['rankings', competitionId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      setImportResult(null);
      setImportError(err instanceof ApiError ? err.message : 'Score import failed');
    },
  });
  const rounds = useMemo(() => (roundsRaw ?? []).map(normalizeRound), [roundsRaw]);
  const hasTeams = (teams?.length ?? 0) > 0;
  /** Latest approved/locked official round — used for overall report approver stamp. */
  const latestApprovedRound = useMemo(() => {
    return (
      [...rounds]
        .filter((r) => r.status === 'APPROVED' || r.status === 'LOCKED')
        .sort((a, b) => b.number - a.number)[0] ?? null
    );
  }, [rounds]);
  const canDownloadStandings = latestApprovedRound != null;
  const officialRounds = useMemo(
    () => rounds.filter((r) => r.type === 'OFFICIAL'),
    [rounds],
  );
  const maxRounds = competition?.maxRounds ?? 12;
  const nextNumber = (rounds.reduce((m, r) => Math.max(m, r.number), 0) || 0) + 1;
  const atMaxOfficial = officialRounds.length >= maxRounds;
  const previousRound = useMemo(() => {
    if (rounds.length === 0) return null;
    return [...rounds].sort((a, b) => b.number - a.number || a.name.localeCompare(b.name))[0];
  }, [rounds]);
  const previousCompleted =
    !previousRound || COMPLETED_FOR_NEXT.includes(previousRound.status);
  /** Dialog can open whenever the previous round is done; practice never hits the official max. */
  const canOpenCreate = previousCompleted;
  const canSubmitCreate =
    previousCompleted && (roundType === 'PRACTICE' || !atMaxOfficial);

  const canCloseCompetition =
    canUpdateCompetition &&
    !!competition?.status &&
    !['COMPLETED', 'ARCHIVED', 'CANCELLED', 'DRAFT'].includes(competition.status);

  const completeCompetitionMutation = useMutation({
    mutationFn: () => api.post(`/competitions/${competitionId}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition', competitionId] });
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', competitionId] });
      queryClient.invalidateQueries({ queryKey: ['rounds', competitionId] });
      queryClient.invalidateQueries({ queryKey: ['rankings', competitionId] });
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({ roundId, action }: { roundId: string; action: RoundAction }) =>
      api.post(`/competitions/${competitionId}/rounds/${roundId}/${action}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rounds', competitionId] });
      queryClient.invalidateQueries({ queryKey: ['rankings', competitionId] });
    },
  });

  const typeMutation = useMutation({
    mutationFn: ({ roundId, type }: { roundId: string; type: RoundType }) =>
      api.patch(`/competitions/${competitionId}/rounds/${roundId}`, { type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rounds', competitionId] });
      queryClient.invalidateQueries({ queryKey: ['rankings', competitionId] });
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post(`/competitions/${competitionId}/rounds`, {
        number: nextNumber,
        name: roundName || `Round ${nextNumber}`,
        type: roundType,
        orderType: 'RANDOM',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rounds', competitionId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCreateOpen(false);
      setRoundName('');
      setRoundType('OFFICIAL');
    },
  });

  const getActions = (
    status: RoundStatus,
  ): { action: RoundAction; label: string; icon: React.ReactNode; variant?: 'default' | 'outline' }[] => {
    switch (status) {
      case 'SCHEDULED':
      case 'BRIEFING':
      case 'OPEN':
        return [{ action: 'start', label: 'Start', icon: <Play className="h-4 w-4" /> }];
      case 'ACTIVE':
        return [
          { action: 'pause', label: 'Pause', icon: <Pause className="h-4 w-4" />, variant: 'outline' },
          { action: 'close', label: 'Close', icon: <Square className="h-4 w-4" />, variant: 'outline' },
        ];
      case 'PAUSED':
        return [
          { action: 'resume', label: 'Resume', icon: <RotateCcw className="h-4 w-4" />, variant: 'outline' },
          { action: 'close', label: 'Close', icon: <Square className="h-4 w-4" />, variant: 'outline' },
        ];
      case 'CLOSED':
      case 'PENDING_APPROVAL':
        return [
          {
            action: 'approve',
            label: 'Approve',
            icon: <CheckCircle className="h-4 w-4" />,
            variant: 'default',
          },
          {
            action: 'reopen',
            label: 'Reopen',
            icon: <RotateCcw className="h-4 w-4" />,
            variant: 'outline',
          },
        ];
      case 'APPROVED':
        return [
          {
            action: 'lock',
            label: 'Lock',
            icon: <Lock className="h-4 w-4" />,
            variant: 'default',
          },
          {
            action: 'reopen',
            label: 'Reopen',
            icon: <RotateCcw className="h-4 w-4" />,
            variant: 'outline',
          },
        ];
      case 'LOCKED':
        return [];
      default:
        return [];
    }
  };

  const handleRoundScoreDownload = async (round: ReturnType<typeof normalizeRound>) => {
    if (!competitionId) return;
    const key = `round:${round.id}`;
    setDownloadError(null);
    setDownloadingKey(key);
    try {
      await downloadReportPdf(competitionId, 'ROUND_RESULTS', round.id);
    } catch (err) {
      setDownloadError({
        roundId: round.id,
        message:
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Download failed',
      });
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleStandingsDownload = async (reportType: 'OVERALL_RESULTS' | 'TEAM_RESULTS') => {
    if (!competitionId || !latestApprovedRound) return;
    const key = `standings:${reportType}`;
    setDownloadError(null);
    setDownloadingKey(key);
    try {
      await downloadReportPdf(competitionId, reportType, latestApprovedRound.id);
    } catch (err) {
      setDownloadError({
        message:
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Download failed',
      });
    } finally {
      setDownloadingKey(null);
    }
  };

  const canDownloadRoundScores = (status: RoundStatus) =>
    status === 'APPROVED' || status === 'LOCKED';

  if (!competitionId) {
    return (
      <p className="text-muted-foreground">
        <Link to="/competitions" className="text-primary underline">
          Open a competition
        </Link>{' '}
        from the Competitions list.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rounds</h1>
          <p className="text-muted-foreground">
            Control round lifecycle · Max {maxRounds} official rounds
            <span className="mt-1 block text-xs">
              Practice rounds do not count toward results or the official max. Approve → Lock for
              finals.
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canDownloadStandings && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={downloadingKey != null}
                onClick={() => void handleStandingsDownload('OVERALL_RESULTS')}
              >
                {downloadingKey === 'standings:OVERALL_RESULTS' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Overall scores
              </Button>
              {hasTeams && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadingKey != null}
                  onClick={() => void handleStandingsDownload('TEAM_RESULTS')}
                >
                  {downloadingKey === 'standings:TEAM_RESULTS' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Team overall scores
                </Button>
              )}
            </>
          )}
          <Button
            variant="outline"
            disabled={importScoresMutation.isPending}
            onClick={() => scoreImportRef.current?.click()}
          >
            {importScoresMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Import scores CSV
          </Button>
          <input
            ref={scoreImportRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) importScoresMutation.mutate(file);
            }}
          />
          {canCloseCompetition && (
            <Button
              variant="outline"
              disabled={completeCompetitionMutation.isPending}
              onClick={() => {
                const ok = window.confirm(
                  'Close this competition? Open rounds will be closed and the venue display will show the final podium (1st–3rd). This is typically used when flying stops early (e.g. weather).',
                );
                if (ok) completeCompetitionMutation.mutate();
              }}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {completeCompetitionMutation.isPending ? 'Closing…' : 'Close competition'}
            </Button>
          )}
          <Button disabled={!canOpenCreate} onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Round
          </Button>
        </div>
      </div>

      {downloadError && !downloadError.roundId && (
        <p className="text-sm text-destructive">{downloadError.message}</p>
      )}

      {importError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {importError}
        </p>
      )}

      {importResult && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          <p className="font-medium text-emerald-700 dark:text-emerald-300">
            Imported {importResult.scoresUpserted} score(s) across rounds{' '}
            {importResult.roundsDetected.join(', ') || '—'}
            {importResult.roundsCreated.length > 0
              ? ` (created rounds ${importResult.roundsCreated.join(', ')})`
              : ''}
            .
          </p>
          <p className="mt-1 text-muted-foreground">
            Format: {importResult.format}. Rows: {importResult.rowsProcessed}. Skipped:{' '}
            {importResult.skipped.length}
            {importResult.unknownPilots.length > 0
              ? `. Unknown pilots: ${importResult.unknownPilots.join(', ')}`
              : ''}
            .
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            CSV: wide sheet with <code className="rounded bg-muted px-1">pilotNumber</code> /{' '}
            <code className="rounded bg-muted px-1">Pilot&apos;s ID</code> and{' '}
            <code className="rounded bg-muted px-1">Round 1…N</code> columns (Rank, Name, Team,
            Total ignored), or long form{' '}
            <code className="rounded bg-muted px-1">pilotNumber,round,score</code>. Cells: cm,
            DNF, DNS, ABS, DSQ. Pilots must already be registered.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Official rounds</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {officialRounds.length}
              <span className="text-base font-normal text-muted-foreground"> / {maxRounds}</span>
            </p>
            {rounds.length > officialRounds.length && (
              <p className="mt-1 text-xs text-muted-foreground">
                +{rounds.length - officialRounds.length} practice (not in results)
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {rounds.filter((r) => r.status === 'ACTIVE').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {rounds.filter((r) => r.status === 'CLOSED' || r.status === 'PENDING_APPROVAL').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Approved / Locked</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {rounds.filter((r) => r.status === 'APPROVED' || r.status === 'LOCKED').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {atMaxOfficial && (
        <p className="text-sm text-muted-foreground">
          Maximum of {maxRounds} official rounds reached. You can still add practice rounds, or
          increase Max Rounds in competition settings.
        </p>
      )}
      {previousRound && !previousCompleted && (
        <p className="text-sm text-muted-foreground">
          Finish Round {previousRound.number} before creating the next one. Close it when scoring is
          done (then approve / lock as needed). Current status:{' '}
          <span className="font-medium text-foreground">{previousRound.status}</span>.
        </p>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Round</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rounds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No rounds yet. Create Round 1 to begin.
                </TableCell>
              </TableRow>
            ) : (
              rounds.map((round) => (
                <TableRow key={round.id}>
                  <TableCell className="font-medium">
                    R{round.number}
                    {round.name ? ` – ${round.name}` : ''}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={round.type}
                      disabled={
                        round.status === 'LOCKED' ||
                        round.status === 'APPROVED' ||
                        typeMutation.isPending
                      }
                      onValueChange={(v) =>
                        typeMutation.mutate({ roundId: round.id, type: v as RoundType })
                      }
                    >
                      <SelectTrigger className="h-8 w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OFFICIAL">OFFICIAL</SelectItem>
                        <SelectItem value="PRACTICE">PRACTICE</SelectItem>
                        <SelectItem value="REFLIGHT">REFLIGHT</SelectItem>
                        <SelectItem value="RESTART">RESTART</SelectItem>
                      </SelectContent>
                    </Select>
                    {typeMutation.isError && typeMutation.variables?.roundId === round.id && (
                      <p className="mt-1 text-xs text-destructive">
                        {typeMutation.error instanceof ApiError
                          ? typeMutation.error.message
                          : 'Failed to update type'}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColors[round.status]}>{round.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {round.flightsScored}/{round.flightsTotal} scored
                  </TableCell>
                  <TableCell>
                    {round.scheduledAt ? new Date(round.scheduledAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {getActions(round.status).map(({ action, label, icon, variant }) => (
                        <Button
                          key={action}
                          size="sm"
                          variant={variant ?? (action === 'start' ? 'default' : 'outline')}
                          disabled={actionMutation.isPending}
                          onClick={() => actionMutation.mutate({ roundId: round.id, action })}
                        >
                          {icon}
                          <span className="ml-1">{label}</span>
                        </Button>
                      ))}
                      {canDownloadRoundScores(round.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={downloadingKey != null}
                          onClick={() => void handleRoundScoreDownload(round)}
                        >
                          {downloadingKey === `round:${round.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          <span className="ml-1">Round score</span>
                        </Button>
                      )}
                      {round.status === 'LOCKED' && (
                        <span className="inline-flex items-center gap-1 self-center px-1 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          Final
                        </span>
                      )}
                    </div>
                    {actionMutation.isError && actionMutation.variables?.roundId === round.id && (
                      <p className="mt-1 text-xs text-destructive">
                        {actionMutation.error instanceof ApiError
                          ? actionMutation.error.message
                          : 'Action failed'}
                      </p>
                    )}
                    {downloadError?.roundId === round.id && (
                      <p className="mt-1 text-xs text-destructive">{downloadError.message}</p>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Round {nextNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Max {maxRounds} official rounds. Practice rounds do not count toward results or that
              limit. Create the next round only after the previous one is closed (or approved /
              locked / cancelled).
            </p>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder={`Round ${nextNumber}`}
                value={roundName}
                onChange={(e) => setRoundName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={roundType}
                onValueChange={(v) => setRoundType(v as 'OFFICIAL' | 'PRACTICE')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OFFICIAL">Official</SelectItem>
                  <SelectItem value="PRACTICE">Practice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createMutation.isError && (
              <p className="text-sm text-destructive">
                {createMutation.error instanceof ApiError
                  ? createMutation.error.message
                  : 'Failed to create round'}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={createMutation.isPending || !canSubmitCreate}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Creating…' : `Create Round ${nextNumber}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
