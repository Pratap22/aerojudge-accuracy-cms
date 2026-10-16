import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Eye, FileSpreadsheet, FileText, Printer, CheckCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@aero-judge/ui';
import type { PrintFormat, ReportType } from '@aero-judge/shared';
import { announcedRoundLabel, isOfficialRound } from '@aero-judge/utils';
import { api, apiFetch } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';

const allReportTypes: { value: ReportType; label: string }[] = [
  { value: 'OVERALL_RESULTS', label: 'Overall Results' },
  { value: 'ROUND_RESULTS', label: 'Round Results' },
  { value: 'TEAM_RESULTS', label: 'Team Results' },
  { value: 'PILOT_LIST', label: 'Pilot List' },
  { value: 'LAUNCH_ORDER', label: 'Launch Order' },
  { value: 'SCORE_SHEETS', label: 'Score Sheets' },
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
  type === 'ROUND_RESULTS' || type === 'SCORE_SHEETS' || type === 'JUDGE_SHEETS';

const civlExportType = (type: ReportType) =>
  type === 'OVERALL_RESULTS' || type === 'ROUND_RESULTS' || type === 'TEAM_RESULTS';

/** Score sheets can be printed before a round number is known. */
const allowsBlankRound = (type: ReportType) => type === 'SCORE_SHEETS';

const BLANK_ROUND = 'blank';

/** Operational worksheets — print/download without an approve step. */
const skipsPrintApproval = (type: ReportType) =>
  type === 'LAUNCH_ORDER' || type === 'SCORE_SHEETS';

interface ReportPreview {
  id: string;
  html: string;
  status: 'DRAFT' | 'APPROVED' | 'PUBLISHED' | 'PREVIEW';
  approvalLine?: string;
  reportType?: ReportType;
  skipsApproval?: boolean;
}

interface RoundOption {
  id: string;
  number: number;
  name: string | null;
  type: string;
  status: string;
}

interface TeamOption {
  id: string;
}

const selectClassName =
  'flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function ReportsPage() {
  const activeCompetitionId = useCompetitionId();
  const [reportType, setReportType] = useState<ReportType>('OVERALL_RESULTS');
  const [format, setFormat] = useState<PrintFormat>('A4_PORTRAIT');
  const [roundId, setRoundId] = useState<string>('');
  const [selectedRoundIds, setSelectedRoundIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [civlRoundId, setCivlRoundId] = useState('');
  const [civlError, setCivlError] = useState<string | null>(null);
  const [civlPending, setCivlPending] = useState(false);

  const { data: rounds } = useQuery({
    queryKey: ['rounds', activeCompetitionId],
    queryFn: () => api.get<RoundOption[]>(`/competitions/${activeCompetitionId}/rounds`),
    enabled: !!activeCompetitionId,
  });

  const { data: teams } = useQuery({
    queryKey: ['teams', activeCompetitionId, 'exists'],
    queryFn: () =>
      api.get<TeamOption[]>(`/competitions/${activeCompetitionId}/teams`, { pageSize: 1 }),
    enabled: !!activeCompetitionId,
  });

  const hasTeams = (teams?.length ?? 0) > 0;
  const reportTypes = hasTeams
    ? allReportTypes
    : allReportTypes.filter((r) => r.value !== 'TEAM_RESULTS');

  const sortedRounds = [...(rounds ?? [])].sort((a, b) => a.number - b.number);
  const officialRounds = sortedRounds.filter((round) => isOfficialRound(round));

  useEffect(() => {
    if (reportType === 'TEAM_RESULTS' && !hasTeams) {
      setReportType('OVERALL_RESULTS');
      setPreview(null);
    }
  }, [reportType, hasTeams]);

  useEffect(() => {
    if (reportType !== 'TEAM_RESULTS') return;
    setCivlRoundId((current) => {
      if (current && officialRounds.some((round) => round.id === current)) return current;
      return officialRounds[officialRounds.length - 1]?.id ?? '';
    });
  }, [reportType, rounds]);

  useEffect(() => {
    if (reportType !== 'ROUND_RESULTS') return;
    const ordered = [...(rounds ?? [])].sort((a, b) => a.number - b.number);
    setSelectedRoundIds((current) => {
      const valid = current.filter((id) => ordered.some((round) => round.id === id));
      if (valid.length > 0) return valid.length === current.length ? current : valid;
      const latest = ordered[ordered.length - 1];
      return latest ? [latest.id] : [];
    });
  }, [reportType, rounds]);

  useEffect(() => {
    if (reportType === 'ROUND_RESULTS' || !needsRoundSelection(reportType)) {
      if (reportType !== 'ROUND_RESULTS') setRoundId('');
      return;
    }
    if (!sortedRounds.length) {
      setRoundId(allowsBlankRound(reportType) ? BLANK_ROUND : '');
      return;
    }
    setRoundId((current) => {
      if (allowsBlankRound(reportType) && current === BLANK_ROUND) return current;
      if (current && sortedRounds.some((r) => r.id === current)) return current;
      return sortedRounds[sortedRounds.length - 1]!.id;
    });
  }, [reportType, rounds]);

  const generateMutation = useMutation({
    mutationFn: () =>
      api.post<ReportPreview>(`/competitions/${activeCompetitionId}/reports/preview`, {
        reportType,
        format,
        ...(reportType === 'ROUND_RESULTS'
          ? { roundIds: selectedRoundIds }
          : needsRoundSelection(reportType) && roundId && roundId !== BLANK_ROUND
            ? { roundId }
            : {}),
      }),
    onSuccess: (data) => {
      setPreview(data);
      setDownloadError(null);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (reportId: string) =>
      api.post<{
        id: string;
        status: string;
        html?: string;
        approvalLine?: string;
      }>(`/competitions/${activeCompetitionId}/reports/${reportId}/approve`),
    onSuccess: (data, reportId) => {
      setPreview((p) =>
        p?.id === reportId
          ? {
              ...p,
              status: 'APPROVED',
              html: data.html ?? p.html,
              approvalLine: data.approvalLine,
            }
          : p,
      );
    },
  });

  const handlePrint = () => {
    if (!preview) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(preview.html);
    win.document.close();
    // Let styles paint before the browser print dialog
    win.focus();
    setTimeout(() => win.print(), 50);
  };

  const handleDownload = async () => {
    if (!preview?.id || !activeCompetitionId) return;
    setDownloadError(null);
    try {
      const response = await apiFetch(
        `/competitions/${activeCompetitionId}/reports/${preview.id}/download`,
        { method: 'GET', params: { format: 'pdf' } },
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

  const handleCivlExport = async () => {
    if (!activeCompetitionId) return;
    setCivlError(null);
    setCivlPending(true);
    try {
      const roundForExport = reportType === 'TEAM_RESULTS' ? civlRoundId : roundId;
      const response = await apiFetch(`/competitions/${activeCompetitionId}/reports/civl`, {
        method: 'POST',
        body: {
          reportType,
          ...(reportType === 'ROUND_RESULTS'
            ? { roundIds: selectedRoundIds }
            : reportType !== 'OVERALL_RESULTS' && roundForExport
              ? { roundId: roundForExport }
              : {}),
        },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? `Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const header = response.headers.get('Content-Disposition') ?? '';
      const filename = /filename="([^"]+)"/.exec(header)?.[1] ?? 'civl-results.xlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setCivlError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setCivlPending(false);
    }
  };

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

  const roundRequired = needsRoundSelection(reportType) && reportType !== 'ROUND_RESULTS';
  const selectedResultRounds = sortedRounds.filter((round) => selectedRoundIds.includes(round.id));
  const selectedAreOfficial =
    selectedResultRounds.length > 0 &&
    selectedResultRounds.every((round) => isOfficialRound(round));
  const canGenerate =
    reportType === 'ROUND_RESULTS' ? selectedRoundIds.length > 0 : !roundRequired || Boolean(roundId);
  const showCivlExport = civlExportType(reportType);
  const civlRoundReady =
    reportType === 'OVERALL_RESULTS' ||
    (reportType === 'ROUND_RESULTS' && selectedAreOfficial) ||
    (reportType === 'TEAM_RESULTS' &&
      officialRounds.some((round) => round.id === civlRoundId));
  const previewReadyToPrint =
    !!preview &&
    (preview.status === 'APPROVED' ||
      preview.status === 'PUBLISHED' ||
      preview.skipsApproval === true ||
      skipsPrintApproval(reportType));
  const showApproveButton =
    !!preview &&
    !skipsPrintApproval(reportType) &&
    !preview.skipsApproval &&
    preview.status !== 'APPROVED' &&
    preview.status !== 'PUBLISHED';

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

            {reportType === 'ROUND_RESULTS' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Rounds</Label>
                  <div className="flex gap-3 text-xs">
                    <button
                      type="button"
                      className="text-primary hover:underline disabled:opacity-50"
                      disabled={sortedRounds.length === 0}
                      onClick={() => {
                        setSelectedRoundIds(sortedRounds.map((round) => round.id));
                        setPreview(null);
                      }}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className="text-primary hover:underline disabled:opacity-50"
                      disabled={officialRounds.length === 0}
                      onClick={() => {
                        setSelectedRoundIds(officialRounds.map((round) => round.id));
                        setPreview(null);
                      }}
                    >
                      Official
                    </button>
                  </div>
                </div>
                <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-input p-2">
                  {sortedRounds.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-muted-foreground">No rounds available</p>
                  ) : (
                    (['PRACTICE', 'OFFICIAL', 'OTHER'] as const).map((group) => {
                      const groupRounds = sortedRounds.filter((round) => {
                        if (group === 'PRACTICE') return round.type === 'PRACTICE';
                        if (group === 'OFFICIAL') return isOfficialRound(round);
                        return round.type !== 'PRACTICE' && !isOfficialRound(round);
                      });
                      if (groupRounds.length === 0) return null;
                      const label =
                        group === 'PRACTICE' ? 'Practice' : group === 'OFFICIAL' ? 'Official' : 'Other';
                      return (
                        <div key={group} className="space-y-0.5">
                          <p className="px-1 pt-1 text-xs font-medium text-muted-foreground">{label}</p>
                          {groupRounds.map((round) => (
                            <label
                              key={round.id}
                              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-primary"
                                checked={selectedRoundIds.includes(round.id)}
                                onChange={() => {
                                  setSelectedRoundIds((current) =>
                                    current.includes(round.id)
                                      ? current.filter((id) => id !== round.id)
                                      : [...current, round.id],
                                  );
                                  setPreview(null);
                                }}
                              />
                              <span>
                                {announcedRoundLabel(round, sortedRounds)} ({round.status})
                              </span>
                            </label>
                          ))}
                        </div>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedRoundIds.length === 0
                    ? 'Select at least one round.'
                    : selectedRoundIds.length === 1
                      ? 'PDF and the CIVL spreadsheet use this round.'
                      : 'The PDF includes each selected round. The CIVL spreadsheet adds a column for each official round.'}
                </p>
              </div>
            )}

            {roundRequired && (
              <div className="space-y-2">
                <Label htmlFor="report-round">Round</Label>
                <select
                  id="report-round"
                  className={selectClassName}
                  value={roundId}
                  disabled={sortedRounds.length === 0 && !allowsBlankRound(reportType)}
                  onChange={(e) => {
                    setRoundId(e.target.value);
                    setPreview(null);
                  }}
                >
                  {allowsBlankRound(reportType) && <option value={BLANK_ROUND}>Blank</option>}
                  {sortedRounds.length === 0 ? (
                    allowsBlankRound(reportType) ? null : (
                      <option value="">No rounds available</option>
                    )
                  ) : (
                    <>
                      {(['PRACTICE', 'OFFICIAL', 'OTHER'] as const).map((group) => {
                        const groupRounds = sortedRounds.filter((round) => {
                          if (group === 'PRACTICE') return round.type === 'PRACTICE';
                          if (group === 'OFFICIAL') return isOfficialRound(round);
                          return round.type !== 'PRACTICE' && !isOfficialRound(round);
                        });
                        if (groupRounds.length === 0) return null;
                        const label =
                          group === 'PRACTICE' ? 'Practice' : group === 'OFFICIAL' ? 'Official' : 'Other';
                        return (
                          <optgroup key={group} label={label}>
                            {groupRounds.map((round) => (
                              <option key={round.id} value={round.id}>
                                {announcedRoundLabel(round, sortedRounds)} ({round.status})
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </>
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

            {showCivlExport && (
              <div className="space-y-2 border-t pt-4">
                {reportType === 'TEAM_RESULTS' && (
                  <div className="space-y-2">
                    <Label htmlFor="civl-round">Round</Label>
                    <select
                      id="civl-round"
                      className={selectClassName}
                      value={civlRoundId}
                      disabled={officialRounds.length === 0}
                      onChange={(event) => {
                        setCivlRoundId(event.target.value);
                        setCivlError(null);
                      }}
                    >
                      {officialRounds.length === 0 ? (
                        <option value="">No official rounds</option>
                      ) : (
                        officialRounds.map((round) => (
                          <option key={round.id} value={round.id}>
                            {announcedRoundLabel(round, sortedRounds)} ({round.status})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}
                {civlError && <p className="text-sm text-destructive">{civlError}</p>}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => void handleCivlExport()}
                  disabled={civlPending || !civlRoundReady}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  {civlPending ? 'Exporting…' : 'Export CIVL spreadsheet'}
                </Button>
                {reportType === 'ROUND_RESULTS' &&
                  selectedRoundIds.length > 0 &&
                  !selectedAreOfficial && (
                    <p className="text-xs text-muted-foreground">
                      CIVL spreadsheets use official rounds.
                    </p>
                  )}
                <p className="text-xs text-muted-foreground">
                  {reportType === 'ROUND_RESULTS' && selectedRoundIds.length > 1
                    ? 'One CIVL spreadsheet, with a column for each selected round.'
                    : 'Spreadsheet in the CIVL results template.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Preview</CardTitle>
              {preview && (
                <Badge
                  variant={
                    previewReadyToPrint || preview.status === 'APPROVED' ? 'success' : 'warning'
                  }
                >
                  {skipsPrintApproval(reportType) || preview.skipsApproval
                    ? 'READY'
                    : preview.status}
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
                    className={`${selectedRoundIds.length > 1 && reportType === 'ROUND_RESULTS' ? 'h-[720px]' : 'h-[500px]'} w-full border-0 bg-white`}
                    sandbox=""
                  />
                </div>
                {downloadError && <p className="text-sm text-destructive">{downloadError}</p>}
                <div className="flex flex-wrap gap-2">
                  {showApproveButton && (
                    <Button
                      onClick={() => approveMutation.mutate(preview.id)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                  )}
                  <Button variant="outline" onClick={handlePrint} disabled={!previewReadyToPrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleDownload()}
                    disabled={!previewReadyToPrint}
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
