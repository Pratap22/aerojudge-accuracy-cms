import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@npha/ui';
import type { PrintFormat, ReportType } from '@npha/shared';
import { api } from '../lib/api';
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

interface ReportPreview {
  id: string;
  html: string;
  status: 'DRAFT' | 'APPROVED' | 'PUBLISHED';
}

export function ReportsPage() {
  const activeCompetitionId = useCompetitionId();
  const [reportType, setReportType] = useState<ReportType>('OVERALL_RESULTS');
  const [format, setFormat] = useState<PrintFormat>('A4_PORTRAIT');
  const [preview, setPreview] = useState<ReportPreview | null>(null);

  const generateMutation = useMutation({
    mutationFn: () =>
      api.post<ReportPreview>(`/competitions/${activeCompetitionId}/reports/preview`, {
        reportType,
        format,
      }),
    onSuccess: setPreview,
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

  const handleDownload = () => {
    window.open(
      `/api/v1/competitions/${activeCompetitionId}/reports/${preview?.id}/download?format=pdf`,
      '_blank',
    );
  };

  if (!activeCompetitionId) {
    return <p className="text-muted-foreground"><a href="/competitions" className="text-secondary underline">Open a competition</a> from the Competitions list.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports & Print</h1>
        <p className="text-muted-foreground">Generate, preview, approve, and print official documents</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
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
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Page Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as PrintFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formats.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              <Eye className="mr-2 h-4 w-4" />
              Generate Preview
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
                <div
                  className="max-h-[500px] overflow-auto rounded-lg border bg-white p-6 text-black shadow-inner"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
                <div className="flex flex-wrap gap-2">
                  {preview.status !== 'APPROVED' && (
                    <Button onClick={() => approveMutation.mutate(preview.id)} disabled={approveMutation.isPending}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                  )}
                  <Button variant="outline" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Button>
                  <Button variant="outline" onClick={handleDownload}>
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
