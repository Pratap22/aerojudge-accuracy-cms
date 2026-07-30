import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Eye, FileText, Printer, CheckCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@npha/ui';
import type { PrintFormat, ReportType } from '@npha/shared';
import { api, getAccessToken } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';

const reportTypes: { value: ReportType; label: string }[] = [
  { value: 'OVERALL_RESULTS', label: 'Overall Results' },
  { value: 'ROUND_RESULTS', label: 'Round Results' },
  { value: 'TEAM_RESULTS', label: 'Team Results' },
  { value: 'PILOT_LIST', label: 'Pilot List' },
  { value: 'LAUNCH_ORDER', label: 'Launch Order' },
  { value: 'JUDGE_SHEETS', label: 'Judge Sheets' },
  { value: 'PILOT_CARDS', label: 'Pilot Cards' },
  { value: 'CERTIFICATES', label: 'Certificates' },
  { value: 'STATISTICS', label: 'Statistics Report' },
];

const formats: { value: PrintFormat; label: string }[] = [
  { value: 'A4_PORTRAIT', label: 'A4 Portrait' },
  { value: 'A4_LANDSCAPE', label: 'A4 Landscape' },
  { value: 'LETTER_PORTRAIT', label: 'Letter Portrait' },
  { value: 'LETTER_LANDSCAPE', label: 'Letter Landscape' },
];

const needsRoundSelection = (type: ReportType) =>
  type === 'ROUND_RESULTS' || type === 'LAUNCH_ORDER';

interface ReportPreview {
  id: string;
  html: string;
  status: 'DRAFT' | 'APPROVED' | 'PUBLISHED' | 'PREVIEW';
}

interface RoundOption {
  id: string;
  number: number;
  name: string | null;
  type: string;
  status: string;
}

const selectClassName =
  'flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function ReportsPage() {
  const activeCompetitionId = useCompetitionId();
  const [reportType, setReportType] = useState<ReportType>('OVERALL_RESULTS');
  const [format, setFormat] = useState<PrintFormat>('A4_PORTRAIT');
  const [roundId, setRoundId] = useState<string>('');
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { data: rounds } = useQuery({
    queryKey: ['rounds', activeCompetitionId],
    queryFn: () => api.get<RoundOption[]>(`/competitions/${activeCompetitionId}/rounds`),
    enabled: !!activeCompetitionId,
  });

  const sortedRounds = [...(rounds ?? [])].sort((a, b) => a.number - b.number);

  useEffect(() => {
    if (!needsRoundSelection(reportType)) {
      setRoundId('');
      return;
    }
    if (!sortedRounds.length) {
      setRoundId('');
      return;
    }
    setRoundId((current) =>
      current && sortedRounds.some((r) => r.id === current)
        ? current
        : sortedRounds[sortedRounds.length - 1]!.id,
    );
  }, [reportType, rounds]);

  const generateMutation = useMutation({
    mutationFn: () =>
      api.post<ReportPreview>(`/competitions/${activeCompetitionId}/reports/preview`, {
        reportType,
        format,
        ...(needsRoundSelection(reportType) && roundId ? { roundId } : {}),
      }),
    onSuccess: (data) => {
      setPreview(data);
      setDownloadError(null);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (reportId: string) =>
      api.post(`/competitions/${activeCompetitionId}/reports/${reportId}/approve`),
    onSuccess: (_, reportId) => {
      setPreview((p) => (p?.id === reportId ? { ...p, status: 'APPROVED' } : p));
    },
  });

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (win && preview) {
      win.document.write(preview.html);
      win.document.close();
      win.print();
    }
  };

  const handleDownload = async () => {
    if (!preview?.id || !activeCompetitionId) return;
    setDownloadError(null);
    try {
      const token = getAccessToken();
      const response = await fetch(
        `/api/v1/competitions/${activeCompetitionId}/reports/${preview.id}/download?format=pdf`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
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
      a.download = `report-${preview.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  if (!activeCompetitionId) {
    return (
      <p className="text-muted-foreground">
        <a href="/competitions" className="text-primary underline">
          Open a competition
        </a>{' '}
        from the Competitions list.
      </p>
    );
  }

  const roundRequired = needsRoundSelection(reportType);
  const canGenerate = !roundRequired || Boolean(roundId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports & Print</h1>
        <p className="text-muted-foreground">
          Generate, preview, approve, and print official documents
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Report Settings
            </CardTitle>
            <CardDescription>Choose report type and page format</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="report-type">Report Type</Label>
              <select
                id="report-type"
                className={selectClassName}
                value={reportType}
                onChange={(e) => {
                  setReportType(e.target.value as ReportType);
                  setPreview(null);
                }}
              >
                {reportTypes.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {roundRequired && (
              <div className="space-y-2">
                <Label htmlFor="report-round">Round</Label>
                <select
                  id="report-round"
                  className={selectClassName}
                  value={roundId}
                  disabled={sortedRounds.length === 0}
                  onChange={(e) => {
                    setRoundId(e.target.value);
                    setPreview(null);
                  }}
                >
                  {sortedRounds.length === 0 ? (
                    <option value="">No rounds available</option>
                  ) : (
                    sortedRounds.map((r) => (
                      <option key={r.id} value={r.id}>
                        Round {r.number}
                        {r.name ? ` — ${r.name}` : ''} ({r.status})
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="report-format">Page Format</Label>
              <select
                id="report-format"
                className={selectClassName}
                value={format}
                onChange={(e) => setFormat(e.target.value as PrintFormat)}
              >
                {formats.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {generateMutation.isError && (
              <p className="text-sm text-destructive">
                {(generateMutation.error as Error)?.message ?? 'Failed to generate preview'}
              </p>
            )}
            <Button
              className="w-full"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || !canGenerate}
            >
              <Eye className="mr-2 h-4 w-4" />
              {generateMutation.isPending ? 'Generating…' : 'Generate Preview'}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Preview</CardTitle>
              {preview && (
                <Badge variant={preview.status === 'APPROVED' ? 'success' : 'warning'}>
                  {preview.status}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {preview ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-lg border bg-white shadow-inner">
                  <iframe
                    title="Report preview"
                    srcDoc={preview.html}
                    className="h-[500px] w-full border-0 bg-white"
                    sandbox=""
                  />
                </div>
                {downloadError && <p className="text-sm text-destructive">{downloadError}</p>}
                <div className="flex flex-wrap gap-2">
                  {preview.status !== 'APPROVED' && preview.status !== 'PUBLISHED' && (
                    <Button
                      onClick={() => approveMutation.mutate(preview.id)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handlePrint}
                    disabled={preview.status !== 'APPROVED' && preview.status !== 'PUBLISHED'}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleDownload()}
                    disabled={preview.status !== 'APPROVED' && preview.status !== 'PUBLISHED'}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                Generate a preview to see the report here
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
